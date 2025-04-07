import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  MoreHorizontal
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

interface CsvUpload {
  id: number;
  filename: string;
  recordsCount: number;
  processedCount: number;
  status: string;
  createdAt: string;
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
    refetchInterval: (data) => {
      // Check if any uploads are still processing
      if (data && data.uploads && data.uploads.some((upload: CsvUpload) => upload.status === 'processing')) {
        // Poll every 3 seconds while processing
        return 3000;
      }
      // Otherwise, don't poll
      return false;
    }
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

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Supplier Management</h1>
        <Button onClick={handleOpenUploadModal}>Upload CSV</Button>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>CSV Import Format</AlertTitle>
        <AlertDescription>
          Upload CSV files with <strong>SKU</strong> and <strong>Origin URL</strong> columns. 
          The system will match SKUs with existing products and use the Origin URLs to 
          check for price discrepancies.
        </AlertDescription>
      </Alert>

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
                className={`border border-dashed rounded-md p-10 ${
                  isDragging ? "border-primary bg-primary/5" : "border-gray-300"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center">
                  <Upload className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="mb-3 text-lg font-medium text-gray-900">
                    {uploadMutation.isPending
                      ? "Uploading files..."
                      : "Drag and drop CSV files here"}
                  </p>
                  <p className="text-sm text-gray-500 mb-5">or</p>
                  <label 
                    htmlFor="file-upload" 
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-md text-sm font-medium cursor-pointer"
                  >
                    Browse Files
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
                  <p className="mt-6 text-sm text-gray-500">
                    Supports multiple CSV files with SKU and Origin URL columns
                  </p>
                </div>
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
                  
                  {recentUploads.uploads.map((upload: CsvUpload) => (
                    <div key={upload.id} className="py-4 first:pt-0 last:pb-0 border-b last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="font-medium">{upload.filename}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center">
                            {getStatusIcon(upload.status)}
                            <span className="ml-2 capitalize">{upload.status}</span>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {upload.status === 'processing' && (
                                <DropdownMenuItem 
                                  onClick={() => setUploadToCancel(upload.id)}
                                  className="text-red-500 focus:text-red-500"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel Processing
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => setUploadToDelete(upload.id)}
                                className="text-red-500 focus:text-red-500"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Upload
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500 mb-2">
                        Uploaded: {formatDate(upload.createdAt)}
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span>{upload.processedCount} of {upload.recordsCount} records processed</span>
                        <span>{Math.round((upload.processedCount / upload.recordsCount) * 100)}%</span>
                      </div>
                      
                      <Progress
                        className={`mt-2 ${
                          upload.status === 'completed' ? '[&>div]:bg-green-500' :
                          upload.status === 'error' ? '[&>div]:bg-red-500' :
                          upload.status === 'processing' ? '[&>div]:bg-blue-500' :
                          ''
                        }`}
                        value={(upload.processedCount / upload.recordsCount) * 100}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                  <p>No CSV uploads found</p>
                  <p className="text-sm mt-2">Upload your first supplier price file to get started</p>
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