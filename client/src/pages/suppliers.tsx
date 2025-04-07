import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  FileText,
  Info,
  Trash2,
  X,
  MoreHorizontal,
  BarChart3,
  PieChart,
  Link as LinkIcon,
  DollarSign,
  ShoppingBag,
  FileText as FileCsv,
  Boxes,
  ArrowUpDown,
  Check,
  Calendar,
  RefreshCw,
  Link2,
  Percent,
  Globe
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { CsvUploadModal } from "@/modals/csv-upload-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Pie,
  LabelList,
  Legend,
} from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface CsvUpload {
  id: number;
  filename: string;
  recordsCount: number;
  processedCount: number;
  status: string;
  createdAt: string;
}

interface DashboardStats {
  productCount: number;
  activeProductCount: number;
  withSupplierUrlCount: number;
  priceDiscrepancyCount: number;
  totalPriceChecks: number;
}

export default function Suppliers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadToDelete, setUploadToDelete] = useState<number | null>(null);
  const [uploadToCancel, setUploadToCancel] = useState<number | null>(null);
  
  // Query recent CSV uploads
  const { data: recentUploads, isLoading, refetch } = useQuery<{uploads: CsvUpload[]}>({
    queryKey: ['/api/csv/uploads'],
    queryFn: async () => {
      const res = await fetch('/api/csv/uploads');
      if (!res.ok) throw new Error('Failed to fetch uploads');
      return res.json();
    },
    // Always poll every 3 seconds to ensure real-time updates
    refetchInterval: 3000
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      
      const res = await apiRequest("POST", "/api/csv/upload", formData);
      return res.json();
    },
    onSuccess: () => {
      // Show success toast
      toast({
        title: "Files uploaded successfully",
        description: "Your supplier price data is being processed.",
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/csv/uploads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message || "There was an error uploading your files.",
        variant: "destructive",
      });
    },
  });
  
  // Delete CSV upload mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/csv/uploads/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Upload deleted",
        description: "The CSV upload has been successfully deleted and supplier prices reset.",
      });
      
      setUploadToDelete(null);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/csv/uploads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message || "There was an error deleting the upload.",
        variant: "destructive",
      });
      
      setUploadToDelete(null);
    },
  });
  
  // Cancel CSV processing mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/csv/uploads/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Processing cancelled",
        description: "The CSV processing has been cancelled and supplier prices reset.",
      });
      
      setUploadToCancel(null);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/csv/uploads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
    },
    onError: (error) => {
      toast({
        title: "Cancel failed",
        description: error.message || "There was an error cancelling the processing.",
        variant: "destructive",
      });
      
      setUploadToCancel(null);
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileArray = Array.from(e.dataTransfer.files);
      const csvFiles = fileArray.filter(file => file.name.endsWith('.csv'));
      
      if (csvFiles.length === 0) {
        toast({
          title: "Invalid file type",
          description: "Please upload only CSV files.",
          variant: "destructive",
        });
        return;
      }
      
      uploadMutation.mutate(csvFiles);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      uploadMutation.mutate(fileArray);
    }
  };

  const handleOpenUploadModal = () => {
    document.dispatchEvent(new CustomEvent('open-csv-upload-modal'));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get dashboard stats for accurate supplier data counts
  const { data: dashboardStats, isLoading: isStatsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });
  
  // Get brand distribution data
  const { data: brandData, isLoading: isBrandsLoading } = useQuery<{name: string, count: number}[]>({
    queryKey: ['/api/shopify/brands'],
  });
  
  // Get discrepancies
  const { data: discrepanciesData, isLoading: isDiscrepanciesLoading } = useQuery<any[]>({
    queryKey: ['/api/products/discrepancies'],
  });
  
  const discrepancies = discrepanciesData || [];
  
  // Calculate supplier statistics using the dashboard stats (more accurate)
  const totalProducts = isStatsLoading ? 0 : dashboardStats?.productCount || 0;
  const withSupplierUrl = isStatsLoading ? 0 : dashboardStats?.withSupplierUrlCount || 0;
  const withSupplierPrice = isStatsLoading ? 0 : dashboardStats?.withSupplierUrlCount || 0; // We use the same count since we don't track this separately
  const withDiscrepancies = isDiscrepanciesLoading ? 0 : discrepancies.length || 0;
  
  // Process vendor distribution data for chart
  const vendorData = brandData || [];
  const topVendors = [...vendorData].sort((a, b) => b.count - a.count).slice(0, 7);
  
  // Create vendor chart data with colors
  const colors = [
    "#3b82f6", "#a855f7", "#ec4899", "#f97316", 
    "#10b981", "#f43f5e", "#0ea5e9", "#14b8a6"
  ];
  
  const vendorChartData = topVendors.map((vendor, index) => ({
    name: vendor.name,
    count: vendor.count,
    color: colors[index % colors.length]
  }));
  
  // Format number function
  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };
  
  // Format percentage from two numbers
  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Supplier Management</h1>
          <p className="text-gray-500 mt-1">Manage supplier URLs and monitor price discrepancies</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
          <Button onClick={handleOpenUploadModal}>
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </Button>
        </div>
      </div>
      
      {/* Overview statistics section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Card className="shadow-sm border border-gray-100 overflow-hidden">
          <CardHeader className="pb-2 pt-6 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
              <div className="p-2 bg-blue-50 rounded-full">
                <Boxes className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-end">
              <h3 className="text-3xl font-bold text-gray-900">{formatNumber(totalProducts)}</h3>
              <span className="text-sm text-gray-500 mb-1 ml-2">items</span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Total products in your inventory
            </p>
            
            <div className="mt-3 flex items-center gap-2 text-xs">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
              <span className="text-gray-500">Synced with Shopify</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border border-gray-100 overflow-hidden">
          <CardHeader className="pb-2 pt-6 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Supplier URLs</CardTitle>
              <div className="p-2 bg-purple-50 rounded-full">
                <LinkIcon className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-end">
              <h3 className="text-3xl font-bold text-gray-900">{formatNumber(withSupplierUrl)}</h3>
              <span className="text-sm text-gray-500 mb-1 ml-2">items</span>
            </div>
            
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Coverage</span>
                <span className="font-medium">{calculatePercentage(withSupplierUrl, totalProducts)}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full" 
                  style={{ width: `${calculatePercentage(withSupplierUrl, totalProducts)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-2 text-xs">
              <div className="h-1.5 w-1.5 rounded-full bg-purple-500"></div>
              <span className="text-gray-500">Products with supplier URLs</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border border-gray-100 overflow-hidden">
          <CardHeader className="pb-2 pt-6 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Supplier Prices</CardTitle>
              <div className="p-2 bg-green-50 rounded-full">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-end">
              <h3 className="text-3xl font-bold text-gray-900">{formatNumber(withSupplierPrice)}</h3>
              <span className="text-sm text-gray-500 mb-1 ml-2">items</span>
            </div>
            
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Coverage</span>
                <span className="font-medium">{calculatePercentage(withSupplierPrice, totalProducts)}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" 
                  style={{ width: `${calculatePercentage(withSupplierPrice, totalProducts)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-2 text-xs">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
              <span className="text-gray-500">Products with scraped prices</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border border-gray-100 overflow-hidden">
          <CardHeader className="pb-2 pt-6 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Price Discrepancies</CardTitle>
              <div className="p-2 bg-orange-50 rounded-full">
                <Percent className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-end">
              <h3 className="text-3xl font-bold text-gray-900">{formatNumber(withDiscrepancies)}</h3>
              <span className="text-sm text-gray-500 mb-1 ml-2">items</span>
            </div>
            
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>% of priced products</span>
                <span className="font-medium">{calculatePercentage(withDiscrepancies, withSupplierPrice)}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full" 
                  style={{ width: `${calculatePercentage(withDiscrepancies, withSupplierPrice)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-2 text-xs">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-500"></div>
              <span className="text-gray-500">Products with different prices</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Vendor distribution chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Vendor Distribution</CardTitle>
            <CardDescription>Top vendors by product count in your catalog</CardDescription>
          </CardHeader>
          <CardContent>
            {isBrandsLoading ? (
              <div className="h-[350px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : vendorChartData.length > 0 ? (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={vendorChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => formatNumber(value)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={150}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${formatNumber(value)} products`, 'Count']}
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        color: '#fff',
                        borderRadius: '4px',
                        border: 'none',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      radius={[0, 4, 4, 0]}
                      barSize={30}
                    >
                      {vendorChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList 
                        dataKey="count" 
                        position="insideRight" 
                        style={{ fill: 'white', fontSize: 12, fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                        formatter={(value: number) => formatNumber(value)}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[350px] flex flex-col items-center justify-center">
                <BarChart3 className="h-16 w-16 text-gray-200 mb-4" />
                <h3 className="font-medium text-lg text-gray-600">No vendor data available</h3>
                <p className="text-gray-500 text-sm max-w-md text-center mt-2">
                  Connect your Shopify store or upload products with vendor information to see your vendor distribution
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t bg-gray-50 py-3">
            <div className="flex flex-wrap gap-2 w-full">
              {vendorChartData.map((vendor, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="flex items-center gap-1"
                  style={{ backgroundColor: `${vendor.color}15`, color: vendor.color, borderColor: `${vendor.color}30` }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: vendor.color }}></span>
                  {vendor.name}: {formatNumber(vendor.count)}
                </Badge>
              ))}
            </div>
          </CardFooter>
        </Card>
        
        <Card className="shadow-sm border border-gray-100 overflow-hidden">
          <CardHeader className="pb-2 pt-6 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Supplier URLs Status</CardTitle>
              <div className="p-2 bg-purple-50 rounded-full">
                <LinkIcon className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pt-2 pb-6">
            {isStatsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-end mb-4">
                  <h3 className="text-3xl font-bold text-gray-900">{formatNumber(withSupplierUrl)}</h3>
                  <span className="text-sm text-gray-500 mb-1 ml-2">of {formatNumber(totalProducts)} products</span>
                </div>
                
                <div className="h-[180px] mb-4 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="gradientWithUrl" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#9333ea" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id="gradientWithoutUrl" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#e2e8f0" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#cbd5e1" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <Pie
                        data={[
                          { name: 'With Supplier URL', value: withSupplierUrl },
                          { name: 'Without Supplier URL', value: totalProducts - withSupplierUrl }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        strokeWidth={4}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="url(#gradientWithUrl)" stroke="#ffffff" />
                        <Cell fill="url(#gradientWithoutUrl)" stroke="#ffffff" />
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string) => [formatNumber(value), name]}
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          color: '#fff',
                          borderRadius: '4px',
                          border: 'none',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="bg-white w-[100px] h-[100px] rounded-full shadow-md flex items-center justify-center">
                      <Globe className="h-14 w-14 text-purple-500" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3.5 mt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 mr-2"></span>
                        <span className="text-sm font-medium">With Supplier URL</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-bold">{formatNumber(withSupplierUrl)}</span>
                        <span className="text-xs text-gray-500 ml-1">
                          ({calculatePercentage(withSupplierUrl, totalProducts)}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full" 
                        style={{ width: `${calculatePercentage(withSupplierUrl, totalProducts)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-400 mr-2"></span>
                        <span className="text-sm font-medium">Without Supplier URL</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-bold">{formatNumber(totalProducts - withSupplierUrl)}</span>
                        <span className="text-xs text-gray-500 ml-1">
                          ({100 - calculatePercentage(withSupplierUrl, totalProducts)}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-gray-300 to-gray-400 rounded-full" 
                        style={{ width: `${100 - calculatePercentage(withSupplierUrl, totalProducts)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-medium">
                        {calculatePercentage(withSupplierUrl, totalProducts)}% Coverage
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" asChild className="text-xs h-8">
                      <a href="/products">View All Products</a>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mb-8"></div>
      
      <Tabs defaultValue="upload">
        <TabsList className="mb-6">
          <TabsTrigger value="upload">CSV Upload</TabsTrigger>
          <TabsTrigger value="history">Upload History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Upload Supplier Price Data</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div 
                className={`border-2 border-dashed rounded-lg p-6 md:p-10 ${
                  isDragging ? "border-primary bg-primary/5" : "border-gray-200"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-20">
                        <FileCsv className="h-16 w-16 text-primary" />
                      </div>
                    </div>
                    <h3 className="mb-1 text-lg font-medium text-gray-900">
                      Processing CSV Files
                    </h3>
                    <p className="text-sm text-gray-500 text-center max-w-md">
                      Your files are being uploaded and processed. This may take a moment depending on the file size.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="bg-gray-50 p-4 rounded-full mb-4">
                      <Upload className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="mb-1 text-lg font-medium text-gray-900">
                      Drop your CSV files here
                    </h3>
                    <p className="text-sm text-gray-500 text-center max-w-md mb-6">
                      Upload CSV files with SKU and Origin URL columns. The system will match SKUs with 
                      existing products and use the Origin URLs to check for price discrepancies.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <label 
                        htmlFor="file-upload" 
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
                      >
                        <span className="flex items-center">
                          <FileCsv className="h-4 w-4 mr-2" />
                          Browse CSV Files
                        </span>
                        <input 
                          id="file-upload" 
                          type="file" 
                          className="hidden" 
                          onChange={handleFileSelection}
                          multiple 
                          accept=".csv" 
                          disabled={uploadMutation.isPending}
                        />
                      </label>
                      <span className="text-sm text-gray-500">or drag and drop</span>
                    </div>
                    
                    <div className="mt-8 flex items-center gap-3 text-xs text-gray-500">
                      <Info className="h-4 w-4" />
                      <span>
                        <strong>Supplier URLs</strong> will be used to scrape prices and check for discrepancies
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Recent CSV Uploads</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : recentUploads?.uploads && recentUploads.uploads.length > 0 ? (
                <div className="divide-y">
                  {/* Summary statistics section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-gray-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <FileText className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <div className="text-2xl font-bold">
                            {recentUploads.uploads.length}
                          </div>
                          <p className="text-sm text-gray-500">Total CSV Uploads</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gray-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <div className="text-2xl font-bold">
                            {recentUploads.uploads.filter((u) => u.status === 'completed').length}
                          </div>
                          <p className="text-sm text-gray-500">Completed Uploads</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gray-50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <Info className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                          <div className="text-2xl font-bold">
                            {recentUploads.uploads.reduce((total: number, upload: CsvUpload) => total + upload.recordsCount, 0)}
                          </div>
                          <p className="text-sm text-gray-500">Total Records Processed</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {recentUploads.uploads.map((upload: CsvUpload) => (
                      <Card key={upload.id} className={`shadow-sm border-l-4 ${
                        upload.status === 'completed' ? 'border-l-green-500' :
                        upload.status === 'error' ? 'border-l-red-500' :
                        upload.status === 'processing' ? 'border-l-blue-500' :
                        'border-l-gray-300'
                      }`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileCsv className="h-5 w-5 text-gray-400" />
                              <CardTitle className="text-base font-medium">{upload.filename}</CardTitle>
                            </div>
                            <Badge variant={
                              upload.status === 'completed' ? 'outline' :
                              upload.status === 'error' ? 'destructive' : 
                              'secondary'
                            }
                            className={`flex items-center gap-1 ${
                              upload.status === 'completed' ? 'bg-green-50 text-green-600 border-green-200' : ''
                            }`}
                            >
                              {getStatusIcon(upload.status)}
                              <span className="capitalize">{upload.status}</span>
                            </Badge>
                          </div>
                          <CardDescription className="mt-2">
                            {format(new Date(upload.createdAt), "MMMM dd, yyyy 'at' h:mm a")}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="bg-gray-50 p-2 rounded-md">
                                <p className="text-gray-500 text-xs mb-1">Records</p>
                                <p className="font-medium">{formatNumber(upload.recordsCount)}</p>
                              </div>
                              <div className="bg-gray-50 p-2 rounded-md">
                                <p className="text-gray-500 text-xs mb-1">Processed</p>
                                <p className="font-medium">
                                  {formatNumber(upload.processedCount)} 
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({Math.round((upload.processedCount / upload.recordsCount) * 100)}%)
                                  </span>
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>Progress</span>
                                <span>{Math.round((upload.processedCount / upload.recordsCount) * 100)}%</span>
                              </div>
                              <Progress
                                className={`h-2 ${
                                  upload.status === 'completed' ? '[&>div]:bg-green-500' :
                                  upload.status === 'error' ? '[&>div]:bg-red-500' :
                                  upload.status === 'processing' ? '[&>div]:bg-blue-500' :
                                  ''
                                }`}
                                value={(upload.processedCount / upload.recordsCount) * 100}
                              />
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0 flex justify-end">
                          <div className="flex items-center gap-2">
                            {upload.status === 'processing' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setUploadToCancel(upload.id)}
                                className="text-red-500 border-red-200 hover:bg-red-50"
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Cancel
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setUploadToDelete(upload.id)}
                              className="text-gray-500"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="bg-gray-50 w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4">
                    <FileCsv className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-700 mb-2">No CSV uploads found</h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-6">
                    Upload your first supplier price file to map SKUs with supplier URLs and start monitoring price discrepancies
                  </p>
                  <Button onClick={handleOpenUploadModal} className="mx-auto">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload First CSV
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Render the CSV upload modal */}
      <CsvUploadModal />
      
      {/* Delete upload confirmation dialog */}
      <AlertDialog open={uploadToDelete !== null} onOpenChange={(open) => !open && setUploadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CSV Upload</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this CSV upload? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (uploadToDelete) {
                  deleteMutation.mutate(uploadToDelete);
                }
              }}
              className="bg-red-500 hover:bg-red-600"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Cancel processing confirmation dialog */}
      <AlertDialog open={uploadToCancel !== null} onOpenChange={(open) => !open && setUploadToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Processing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the processing of this CSV upload? This will stop any remaining records from being processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Continue Processing</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (uploadToCancel) {
                  cancelMutation.mutate(uploadToCancel);
                }
              }}
              className="bg-red-500 hover:bg-red-600"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Processing'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}