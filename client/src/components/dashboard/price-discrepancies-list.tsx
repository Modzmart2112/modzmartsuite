import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Trash2, RefreshCw, ArrowRight, Redo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import type { PriceDiscrepancy } from "@shared/types";

export function PriceDiscrepancyList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Fetch price discrepancies data with aggressive refresh settings
  const { data: discrepancies = [], isLoading } = useQuery<PriceDiscrepancy[]>({
    queryKey: ['/api/products/discrepancies'],
    // Refetch frequently to keep data updated
    refetchInterval: 5000,
    // Fresh data
    staleTime: 0,
    // Enable automatic refetching when window regains focus
    refetchOnWindowFocus: true,
  });

  // Mutation to clear all price discrepancies
  const clearAllDiscrepanciesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/products/discrepancies/clear-all');
    },
    onSuccess: (data: {success?: boolean, message?: string, clearedCount?: number}) => {
      toast({
        title: "Success",
        description: data.message || `Cleared ${data.clearedCount || 0} price discrepancies`,
      });
      // Invalidate the discrepancies query and dashboard stats to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
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
  
  // Mutation to re-scrape a product price
  const reScrapeProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      return await apiRequest('POST', `/api/products/${productId}/rescrape`);
    },
    onSuccess: (data: {success?: boolean, message?: string, product?: any}) => {
      toast({
        title: "Success",
        description: `Successfully re-checked product price`,
      });
      // Invalidate the discrepancies query and dashboard stats to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to re-check product price",
        variant: "destructive",
      });
      console.error("Error re-scraping product price:", error);
    }
  });

  // Mutation to clear a single price discrepancy
  const clearDiscrepancyMutation = useMutation({
    mutationFn: async (productId: number) => {
      return await apiRequest('POST', `/api/products/discrepancies/${productId}/clear`);
    },
    onSuccess: (data: {message?: string, productId?: number}) => {
      toast({
        title: "Success",
        description: data.message || "Price discrepancy cleared",
      });
      // Invalidate the discrepancies query and dashboard stats to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
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
  
  // Function to handle re-scraping a product with proper UI state management
  const handleReScrapeProduct = (productId: number) => {
    if (reScrapeProductMutation.isPending) return;
    reScrapeProductMutation.mutate(productId);
  };
  
  // Mutation to re-check all products with price discrepancies
  const reCheckAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/products/recheck-all');
    },
    onSuccess: (data) => {
      toast({
        title: "Re-check Complete",
        description: `Re-checked ${data.totalChecked || 0} products with price discrepancies. Found ${data.updatedCount || 0} updates.`,
      });
      // Invalidate the discrepancies query and dashboard stats to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to re-check all prices",
        variant: "destructive",
      });
      console.error("Error re-checking all prices:", error);
    }
  });
  
  // Function to handle re-checking all products with proper UI state management
  const handleReCheckAll = () => {
    if (reCheckAllMutation.isPending) return;
    reCheckAllMutation.mutate();
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
      return await apiRequest("POST", "/api/products/update-price", {
        productId,
        newPrice
      });
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
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
            <CardTitle className="text-lg">Price Discrepancies</CardTitle>
          </div>
          <Badge variant="outline" className="text-yellow-600 border-yellow-500">
            {discrepancies.length} Found
          </Badge>
        </div>
        {discrepancies.length > 0 && (
          <div className="flex space-x-2 mt-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 text-sm font-medium" 
              onClick={() => handleReCheckAll()}
              disabled={reCheckAllMutation.isPending}
            >
              <Redo size={14} />
              Re-check Discrepancies
              {reCheckAllMutation.isPending && "..."}
            </Button>
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
          </div>
        )}
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
                    <div className="flex flex-col space-y-2">
                      <div className="flex space-x-2">
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleUpdatePrice(discrepancy)}
                          disabled={updatePriceMutation.isPending}
                        >
                          Update Price
                        </Button>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleClearDiscrepancy(discrepancy.productId)}
                        disabled={clearDiscrepancyMutation.isPending}
                      >
                        {clearDiscrepancyMutation.isPending ? "Dismissing..." : "Dismiss"}
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