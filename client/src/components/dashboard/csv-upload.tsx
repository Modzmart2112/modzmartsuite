import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function CsvUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    // Initialize with current time
    const now = new Date();
    return `Today at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      
      return apiRequest("/api/csv/upload", {
        method: "POST",
        data: formData
      });
    },
    onSuccess: () => {
      // Update last sync time
      const now = new Date();
      setLastSyncTime(`Today at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      
      // Show success toast
      toast({
        title: "Files uploaded successfully",
        description: "Your supplier price data is being processed.",
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message || "There was an error uploading your files.",
        variant: "destructive",
      });
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

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 mb-2 md:mb-0">Supplier Price Import</h2>
          
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              Last sync: <span className="font-medium ml-1">{lastSyncTime}</span>
            </div>
            <Button
              onClick={handleOpenUploadModal}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload CSV"}
            </Button>
          </div>
        </div>
        
        <div 
          className={`border border-dashed rounded-md p-6 ${
            isDragging ? "border-primary bg-primary/5" : "border-gray-300"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center">
            <Upload className="h-12 w-12 text-gray-400 mb-3" />
            <p className="mb-2 text-sm font-medium text-gray-900">
              {uploadMutation.isPending
                ? "Uploading files..."
                : "Drag and drop CSV files here"}
            </p>
            <p className="text-xs text-gray-500 mb-4">or</p>
            <label 
              htmlFor="file-upload" 
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
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
            <p className="mt-4 text-xs text-gray-500">
              Supports multiple CSV files with SKU and Origin URL columns
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
