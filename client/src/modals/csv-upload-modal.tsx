import { useState, useEffect } from "react";
import { X, Upload, Check, Trash2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { validateCSVFile } from "@/lib/utils/csv-parser";
import { CsvRecord } from "@shared/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type SelectedFile = {
  file: File;
  status: "pending" | "valid" | "invalid" | "processing";
  recordCount?: number;
  errorMessage?: string;
};

export function CsvUploadModal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("files", file);
      });
      
      const res = await apiRequest("POST", "/api/csv/upload", formData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Files uploaded successfully",
        description: "Your supplier price data is being processed.",
      });
      
      // Close modal
      setOpen(false);
      setSelectedFiles([]);
      
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

  // Listen for custom event to open modal
  useEffect(() => {
    const handleOpenModal = () => setOpen(true);
    document.addEventListener('open-csv-upload-modal', handleOpenModal);
    
    return () => {
      document.removeEventListener('open-csv-upload-modal', handleOpenModal);
    };
  }, []);

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
      
      handleFiles(csvFiles);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      handleFiles(fileArray);
    }
  };

  const handleFiles = async (files: File[]) => {
    const newSelectedFiles: SelectedFile[] = files.map(file => ({
      file,
      status: "pending"
    }));
    
    setSelectedFiles(prev => [...prev, ...newSelectedFiles]);
    
    // Validate each file
    for (let i = 0; i < newSelectedFiles.length; i++) {
      const selectedFile = newSelectedFiles[i];
      
      try {
        const validation = await validateCSVFile(selectedFile.file);
        
        setSelectedFiles(prev => prev.map(sf => 
          sf.file === selectedFile.file
            ? { 
                ...sf, 
                status: validation.valid ? "valid" : "invalid",
                recordCount: validation.recordCount,
                errorMessage: validation.message
              }
            : sf
        ));
      } catch (error) {
        setSelectedFiles(prev => prev.map(sf => 
          sf.file === selectedFile.file
            ? { 
                ...sf, 
                status: "invalid",
                errorMessage: "Failed to validate file"
              }
            : sf
        ));
      }
    }
  };

  const removeFile = (file: File) => {
    setSelectedFiles(prev => prev.filter(sf => sf.file !== file));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
  };

  const handleUpload = () => {
    const validFiles = selectedFiles
      .filter(sf => sf.status === "valid")
      .map(sf => sf.file);
    
    if (validFiles.length === 0) {
      toast({
        title: "No valid files",
        description: "Please add at least one valid CSV file.",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate(validFiles);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Supplier Price Files</DialogTitle>
          <DialogDescription>
            Upload your supplier CSV files with SKU and Origin URL columns. The system will compare prices and alert you of any discrepancies.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
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
                htmlFor="modal-file-upload" 
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
              >
                Browse Files
                <input 
                  id="modal-file-upload" 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileSelection}
                  multiple 
                  accept=".csv" 
                  disabled={uploadMutation.isPending}
                />
              </label>
            </div>
          </div>
        </div>
        
        {selectedFiles.length > 0 && (
          <div className="border rounded-md divide-y mt-4">
            <div className="p-4 flex items-center justify-between bg-gray-50">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">Selected Files</span>
              </div>
              <button 
                type="button" 
                className="text-sm text-primary hover:text-primary-600"
                onClick={clearAllFiles}
              >
                Clear All
              </button>
            </div>
            
            {selectedFiles.map((selectedFile, index) => (
              <div key={index} className="p-4 flex items-center justify-between">
                <div className="flex items-center">
                  {selectedFile.status === "valid" ? (
                    <Check className="h-5 w-5 text-green-500 mr-2" />
                  ) : selectedFile.status === "invalid" ? (
                    <X className="h-5 w-5 text-red-500 mr-2" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-400 mr-2" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-700">{selectedFile.file.name}</span>
                    {selectedFile.recordCount && (
                      <span className="ml-2 text-xs text-gray-500">({selectedFile.recordCount} items)</span>
                    )}
                    {selectedFile.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">{selectedFile.errorMessage}</p>
                    )}
                  </div>
                </div>
                <button 
                  type="button" 
                  className="text-sm text-gray-400 hover:text-gray-600"
                  onClick={() => removeFile(selectedFile.file)}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <DialogFooter className="flex items-center justify-end space-x-2 pt-4">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={uploadMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={
              uploadMutation.isPending || 
              selectedFiles.length === 0 || 
              !selectedFiles.some(sf => sf.status === "valid")
            }
          >
            {uploadMutation.isPending ? "Uploading..." : "Upload & Process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
