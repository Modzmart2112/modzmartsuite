import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, RefreshCw, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import type { PriceDiscrepancy } from "@shared/types";

export function PriceDiscrepancyList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Fetch price discrepancies data
  const { data: discrepancies = [], isLoading } = useQuery<PriceDiscrepancy[]>({
    queryKey: ['/api/products/discrepancies'],
  });

  // Mutation to clear price discrepancies
  const clearAllDiscrepanciesMutation = useMutation({
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

  // Mutation to clear a single price discrepancy
  const clearDiscrepancyMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await apiRequest('POST', `/api/products/discrepancies/${productId}/clear`);
      return await response.json();
    },
    onSuccess: (data: {message?: string, productId?: number}) => {
      toast({
        title: "Success",
        description: data.message || "Price discrepancy cleared",
      });
      // Invalidate the discrepancies query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to clear price discrepancy",
        variant: "destructive",
      });
      console.error("Error clearing price discrepancy:", error);
    }
  });
  
  // Function to handle clearing a single discrepancy with proper UI state management
  const handleClearDiscrepancy = (productId: number) => {
    if (clearDiscrepancyMutation.isPending) return;
    clearDiscrepancyMutation.mutate(productId);
  };

  // Mutation to update a product's price
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
    onSuccess: (data, variables) => {
      toast({
        title: "Price updated successfully",
        description: `Updated product price to $${variables.newPrice.toFixed(2)}`,
      });
      
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

  const handleUpdatePrice = (discrepancy: PriceDiscrepancy) => {
    updatePriceMutation.mutate({
      productId: discrepancy.productId,
      newPrice: discrepancy.supplierPrice
    });
  };

  // Format price with currency symbol
  const formatPrice = (price: number): string => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Calculate percentage difference
  const getPercentageBadge = (percentageDifference: number) => {
    const isNegative = percentageDifference < 0;
    const absPercentage = Math.abs(percentageDifference);
    const formatted = `${isNegative ? '-' : '+'}${absPercentage.toFixed(1)}%`;
    
    if (isNegative) {
      return <Badge variant="outline" className="bg-red-100 text-red-800">{formatted}</Badge>;
    } else {
      return <Badge variant="outline" className="bg-green-100 text-green-800">{formatted}</Badge>;
    }
  };

  // Get a limited list of discrepancies to show based on expanded state
  const displayDiscrepancies = isExpanded ? discrepancies : discrepancies.slice(0, 5);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold">Price Discrepancies</CardTitle>
          {discrepancies.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 text-sm font-medium" 
              onClick={() => clearAllDiscrepanciesMutation.mutate()}
              disabled={clearAllDiscrepanciesMutation.isPending}
            >
              <Trash2 size={14} />
              Clear All
              {clearAllDiscrepanciesMutation.isPending && "..."}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex justify-center p-6">
            <RefreshCw className="h-10 w-10 text-gray-300 animate-spin" />
          </div>
        ) : discrepancies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No price discrepancies found
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {displayDiscrepancies.map((discrepancy) => (
                <div key={discrepancy.productId} className="border rounded-md p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium text-gray-900">{discrepancy.title}</h3>
                        {getPercentageBadge(discrepancy.percentageDifference)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">SKU: {discrepancy.sku}</p>
                      <div className="mt-2 flex items-center space-x-3">
                        <div>
                          <p className="text-xs text-gray-500">Shopify</p>
                          <p className="text-sm font-medium text-gray-900">{formatPrice(discrepancy.shopifyPrice)}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Supplier</p>
                          <p className="text-sm font-medium text-primary">{formatPrice(discrepancy.supplierPrice)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleClearDiscrepancy(discrepancy.productId)}
                        disabled={clearDiscrepancyMutation.isPending}
                      >
                        {clearDiscrepancyMutation.isPending ? "Dismissing..." : "Dismiss"}
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleUpdatePrice(discrepancy)}
                        disabled={updatePriceMutation.isPending}
                      >
                        Update Price
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {discrepancies.length > 5 && (
              <div className="mt-4 text-center">
                <Button 
                  variant="link" 
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? "Show Less" : `Show All (${discrepancies.length})`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}