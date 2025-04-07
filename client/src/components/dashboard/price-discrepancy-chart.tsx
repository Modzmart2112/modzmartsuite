import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area
} from 'recharts';
import type { PriceDiscrepancy } from "@shared/types";
import { useMemo } from "react";

// Function to format price with commas
const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Define type for price history records
interface PriceHistoryRecord {
  id: number;
  productId: number;
  shopifyPrice: number;
  supplierPrice: number;
  createdAt: string | Date;
}

export function PriceDiscrepancyChart() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch dashboard stats from API
  const { data: stats = { totalRevenue: 0 }, isLoading } = useQuery<{ totalRevenue: number }>({
    queryKey: ['/api/dashboard/stats'],
  });

  // Fetch price discrepancies data
  const { data: discrepancies = [], isLoading: isLoadingDiscrepancies } = useQuery<PriceDiscrepancy[]>({
    queryKey: ['/api/products/discrepancies'],
  });
  
  // Fetch price history data
  const { data: priceHistories = [] } = useQuery<PriceHistoryRecord[]>({
    queryKey: ['/api/products/price-histories'],
  });
  
  // Mutation to clear price discrepancies
  const clearDiscrepanciesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/products/discrepancies/clear');
      return await response.json();
    },
    onSuccess: (data: {message?: string, count?: number}) => {
      toast({
        title: "Success",
        description: data.message || `Cleared ${data.count || 0} price discrepancies`,
      });
      // Invalidate the discrepancies query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to clear price discrepancies",
        variant: "destructive",
      });
      console.error("Error clearing price discrepancies:", error);
    }
  });

  // Process data for the chart
  const chartData = useMemo(() => {
    const now = new Date();
    
    // Define the date type
    interface DateData {
      date: Date;
      dateString: string;
      supplierPrice: number;
      shopifyPrice: number;
      count: number;
    }
    
    const dates: DateData[] = [];
    
    // Create dates for the past 6 days
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      dates.push({
        date,
        dateString: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        supplierPrice: 0,
        shopifyPrice: 0,
        count: 0
      });
    }
    
    // Group price histories by date
    if (Array.isArray(priceHistories) && priceHistories.length > 0) {
      priceHistories.forEach((history: PriceHistoryRecord) => {
        const historyDate = new Date(history.createdAt);
        const dateString = historyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const matchingDay = dates.find(d => d.dateString === dateString);
        if (matchingDay) {
          matchingDay.supplierPrice += history.supplierPrice || 0;
          matchingDay.shopifyPrice += history.shopifyPrice || 0;
          matchingDay.count += 1;
        }
      });
      
      // Calculate averages
      dates.forEach(day => {
        if (day.count > 0) {
          day.supplierPrice = day.supplierPrice / day.count;
          day.shopifyPrice = day.shopifyPrice / day.count;
        }
      });
    }
    
    // Format for chart component
    return dates.map(day => ({
      month: day.dateString,
      netSales: day.supplierPrice,
      cost: day.shopifyPrice
    }));
  }, [priceHistories]);

  // Calculate average difference with proper formatting
  const calculateAverageDifference = (): string => {
    if (!Array.isArray(discrepancies) || discrepancies.length === 0) return '$0.00';
    
    const avgDiff = discrepancies.reduce((sum: number, d: PriceDiscrepancy) => 
      sum + Math.abs(d.difference), 0) / discrepancies.length;
    
    return `$${formatPrice(avgDiff)}`;
  };

  const formatTotalRevenue = (): string => {
    if (isLoading) return '...';
    const revenueInK = (stats as any).totalRevenue / 1000;
    return `$${formatPrice(revenueInK)}K`;
  };

  return (
    <Card className="shadow-md">
      <CardContent className="p-0">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Price Discrepancies & Costs</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-primary rounded-full mr-2"></span>
                <span className="text-xs text-gray-600">Supplier Price</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
                <span className="text-xs text-gray-600">Shopify Price</span>
              </div>
              <span className="text-sm text-gray-500 ml-4">Last 90 days</span>
              {Array.isArray(discrepancies) && discrepancies.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-4 gap-1 text-sm font-medium" 
                  onClick={() => clearDiscrepanciesMutation.mutate()}
                  disabled={clearDiscrepanciesMutation.isPending}
                >
                  <Trash2 size={14} />
                  Clear All
                  {clearDiscrepanciesMutation.isPending && "..."}
                </Button>
              )}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6 p-6">
          <div className="col-span-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Revenue</h3>
                <div className="text-3xl font-bold text-gray-900">
                  {formatTotalRevenue()}
                </div>
                <div className="flex items-center mt-1">
                  <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                    +19.2%
                  </Badge>
                  <span className="text-xs text-gray-500 ml-2">vs prev. 90 days</span>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Price Discrepancies</h3>
                <div className="text-3xl font-bold text-gray-900">
                  {Array.isArray(discrepancies) ? discrepancies.length : 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Products with price differences
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Avg. Difference</h3>
                <div className="text-3xl font-bold text-gray-900">
                  {calculateAverageDifference()}
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-span-8">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 10,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12 }} 
                    width={40}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${formatPrice(value)}`, '']}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                      padding: '10px'
                    }}
                  />
                  <defs>
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5E30AB" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#5E30AB" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="purpleShadow" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#5E30AB" floodOpacity="0.2"/>
                    </filter>
                    <filter id="blueShadow" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#38BDF8" floodOpacity="0.2"/>
                    </filter>
                  </defs>
                  
                  {/* Fill areas under the lines */}
                  <Area 
                    type="monotone"
                    dataKey="netSales"
                    stroke="#5E30AB"
                    strokeWidth={0}
                    fillOpacity={1}
                    fill="url(#colorPrimary)"
                  />
                  <Area 
                    type="monotone"
                    dataKey="cost"
                    stroke="#38BDF8"
                    strokeWidth={0}
                    fillOpacity={1}
                    fill="url(#colorBlue)"
                  />
                  
                  {/* Main lines with shadows */}
                  <Line 
                    type="monotone" 
                    dataKey="netSales" 
                    name="Supplier Price"
                    stroke="#5E30AB" 
                    strokeWidth={3}
                    filter="url(#purpleShadow)"
                    dot={{ r: 6, strokeWidth: 3, fill: "#fff", stroke: "#5E30AB" }}
                    activeDot={{ r: 8, strokeWidth: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    name="Shopify Price"
                    stroke="#38BDF8" 
                    strokeWidth={3}
                    filter="url(#blueShadow)"
                    dot={{ r: 6, strokeWidth: 3, fill: "#fff", stroke: "#38BDF8" }}
                    activeDot={{ r: 8, strokeWidth: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}