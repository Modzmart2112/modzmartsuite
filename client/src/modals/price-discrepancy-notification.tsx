import { useState, useEffect } from "react";
import { AlertCircle, X, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PriceDiscrepancy } from "@shared/types";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export function PriceDiscrepancyNotification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [currentDiscrepancy, setCurrentDiscrepancy] = useState<PriceDiscrepancy | null>(null);
  const [dismissing, setDismissing] = useState(false);

  // Fetch price discrepancies
  const { data: discrepancies, isLoading, error } = useQuery({
    queryKey: ['/api/products/discrepancies'],
    // Only check for discrepancies every minute to avoid excessive API calls
    refetchInterval: 60000,
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({
      productId,
      newPrice
    }: {
      productId: number;
      newPrice: number;
    }) => {
      const res = await apiRequest("POST", "/api/products/update-price", {
        productId,
        newPrice
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Price updated successfully",
        description: "The product price has been updated to match the supplier price.",
      });
      
      // Close notification
      handleDismiss();
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Error updating price",
        description: error.message || "There was an error updating the product price.",
        variant: "destructive",
      });
    },
  });

  // Show notification when discrepancies are found
  useEffect(() => {
    if (discrepancies && discrepancies.length > 0 && !visible && !dismissing) {
      setCurrentDiscrepancy(discrepancies[0]);
      setVisible(true);
    }
  }, [discrepancies, visible, dismissing]);

  const handleDismiss = () => {
    setDismissing(true);
    setVisible(false);
    
    // Reset after animation completes
    setTimeout(() => {
      setCurrentDiscrepancy(null);
      setDismissing(false);
    }, 500);
  };

  const handleUpdatePrice = () => {
    if (!currentDiscrepancy) return;
    
    updatePriceMutation.mutate({
      productId: currentDiscrepancy.productId,
      newPrice: currentDiscrepancy.supplierPrice
    });
  };

  if (!visible || !currentDiscrepancy) return null;

  return (
    <div className="fixed bottom-0 right-0 m-6 z-40 max-w-md w-full transform transition-all duration-300">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-red-500 px-4 py-2 flex items-center justify-between">
          <h3 className="text-white font-medium">Price Discrepancy Alert</h3>
          <button 
            className="text-white hover:text-red-100"
            onClick={handleDismiss}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="px-4 py-3 border-b">
          <p className="text-sm text-gray-600">The following product price has changed at the supplier:</p>
        </div>
        
        <div className="px-4 py-3">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">{currentDiscrepancy.title}</h4>
              <p className="text-sm text-gray-600 mt-1">SKU: {currentDiscrepancy.sku}</p>
              <div className="mt-2 flex items-center space-x-4">
                <div>
                  <p className="text-xs text-gray-500">Current Price</p>
                  <p className="text-sm font-medium text-gray-900">${currentDiscrepancy.shopifyPrice.toFixed(2)}</p>
                </div>
                <div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Supplier Price</p>
                  <p className="text-sm font-medium text-red-600">${currentDiscrepancy.supplierPrice.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-4 py-3 flex justify-end">
          <Button
            variant="ghost"
            className="text-sm text-gray-600 mr-4"
            onClick={handleDismiss}
          >
            Dismiss
          </Button>
          <Button 
            variant="ghost" 
            className="text-sm text-primary font-medium"
            onClick={handleUpdatePrice}
            disabled={updatePriceMutation.isPending}
          >
            {updatePriceMutation.isPending ? "Updating..." : "Update Price"}
          </Button>
        </div>
      </div>
    </div>
  );
}
