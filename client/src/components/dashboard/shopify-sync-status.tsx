import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Loader2, RefreshCw, CheckCircle, XCircle, 
  ShoppingCart, Clock, ChevronRight,
  BarChart2, Zap, Check, CircleDashed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ShopifySyncStatus() {
  // State for cost price log entries
  const [costPriceLogs, setCostPriceLogs] = useState<Array<{ sku: string, price: string, timestamp: Date }>>([]);
  
  // Fetch scheduler status
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/scheduler/status"],
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch Shopify connection status
  const shopifyConnectionQuery = useQuery({
    queryKey: ["/api/shopify/status"],
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  
  // Fetch sync progress with fast refresh
  const syncProgressQuery = useQuery({
    queryKey: ["/api/scheduler/shopify-sync-progress"],
    refetchInterval: 1000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Effect to fetch cost prices
  useEffect(() => {
    // Check if we have a sync in progress
    const syncProgress = syncProgressQuery.data;
    const isSyncing = syncProgress && (syncProgress.status === 'pending' || syncProgress.status === 'in-progress');
    
    if (isSyncing) {
      // Function to fetch the server logs via the API
      const fetchLogs = async () => {
        try {
          const response = await fetch('/api/logs/shopify');
          if (response.ok) {
            const logsData = await response.json();
            
            // Parse logs for cost price information
            const newLogs: Array<{ sku: string, price: string, timestamp: Date }> = [];
            
            logsData.forEach((log: any) => {
              // First check if log has metadata from cost-logger module
              if (log.metadata && log.metadata.type === 'cost_price' && log.metadata.sku && log.metadata.price) {
                newLogs.push({
                  sku: log.metadata.sku,
                  price: log.metadata.price.toFixed(2),
                  timestamp: new Date(log.createdAt)
                });
              } else {
                // Fall back to regex extraction
                const match = /Got cost price for ([A-Za-z0-9-]+): \$([\d.]+)/.exec(log.message);
                if (match && match[1] && match[2]) {
                  // Only include products with a valid cost price
                  const price = parseFloat(match[2]);
                  if (!isNaN(price) && price > 0) {
                    newLogs.push({
                      sku: match[1],
                      price: match[2],
                      timestamp: new Date(log.createdAt)
                    });
                  }
                }
              }
            });
            
            // Update state with most recent logs first, limit to 20 items for better performance
            if (newLogs.length > 0) {
              setCostPriceLogs(prevLogs => {
                // Combine new logs with existing ones
                const combined = [...newLogs, ...prevLogs];
                
                // Remove duplicates by SKU (keep most recent)
                const uniqueLogs = combined.reduce((acc, current) => {
                  const x = acc.find(item => item.sku === current.sku);
                  if (!x) {
                    return acc.concat([current]);
                  } else {
                    return acc;
                  }
                }, [] as Array<{ sku: string, price: string, timestamp: Date }>);
                
                // Sort by most recent first and limit
                return uniqueLogs
                  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                  .slice(0, 20);
              });
            }
          }
        } catch (error) {
          console.error("Error fetching Shopify logs:", error);
        }
      };
      
      fetchLogs();
      const intervalId = setInterval(fetchLogs, 2000);
      return () => clearInterval(intervalId);
    }
  }, [syncProgressQuery.data]);

  // Formatted last sync time
  const lastSyncTime = data?.lastShopifySync 
    ? new Date(data.lastShopifySync) 
    : null;

  const formattedLastSync = lastSyncTime
    ? `${formatDistanceToNow(lastSyncTime)} ago`
    : "Never";

  // Is Shopify sync job active
  const isShopifySyncActive = data?.activeJobs?.includes("hourly-shopify-sync") || false;
  
  // Sync progress data
  const syncProgress = syncProgressQuery.data;
  const isSyncing = syncProgress && (syncProgress.status === 'pending' || syncProgress.status === 'in-progress');
  
  // Progress message and counts
  const progressMessage = syncProgress?.message || 'Initializing...';
  const processedItems = syncProgress?.processedItems || 0;
  const totalItems = syncProgress?.totalItems || 0;
  const uniqueProductCount = syncProgress?.details?.uniqueProductCount || 0;
  
  // Determine active step
  const isStep1Active = syncProgress?.message?.includes("Counting") || false;
  const isStep2Active = !isStep1Active && (syncProgress?.message?.includes("Processing") || (processedItems > 0 && processedItems < totalItems)) || false;
  const isStep3Active = !isStep1Active && !isStep2Active && syncProgress?.message?.includes("Completing") || false;
  const isComplete = syncProgress?.status === "complete";
  
  // Calculate estimated completion time
  const eta = syncProgress?.details?.estimatedCompletionTime 
    ? format(new Date(syncProgress.details.estimatedCompletionTime), "h:mm a")
    : null;
  
  // Calculate elapsed time
  const startTime = syncProgress?.startedAt ? new Date(syncProgress.startedAt) : null;
  const elapsedTime = startTime 
    ? formatDistanceToNow(startTime, { includeSeconds: true })
    : null;

  // Handle manual sync
  const handleManualSync = async () => {
    try {
      setCostPriceLogs([]);
      
      const response = await fetch("/api/scheduler/run-shopify-sync", {
        method: "POST",
      });
      
      if (response.ok) {
        toast({
          title: "Shopify Sync Started",
          description: "Product synchronization has been initiated",
        });
        
        setTimeout(() => {
          refetch();
          syncProgressQuery.refetch();
        }, 1000);
      } else {
        const errorData = await response.json();
        toast({
          title: "Sync Failed",
          description: errorData?.message || "Could not start Shopify sync",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting sync:", error);
      toast({
        title: "Error",
        description: "An error occurred while syncing with Shopify",
        variant: "destructive",
      });
    }
  };
  
  // Handle reset for stuck sync
  const handleResetSync = async () => {
    try {
      const response = await fetch("/api/scheduler/reset-shopify-sync", {
        method: "POST",
      });
      
      if (response.ok) {
        toast({
          title: "Sync Reset Complete",
          description: "Shopify sync has been reset successfully",
        });
        
        setCostPriceLogs([]);
        refetch();
        syncProgressQuery.refetch();
      } else {
        const errorData = await response.json();
        toast({
          title: "Reset Failed",
          description: errorData?.message || "Could not reset Shopify sync",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error resetting sync:", error);
      toast({
        title: "Error",
        description: "An error occurred while resetting sync status",
        variant: "destructive",
      });
    }
  };

  // Connection status
  const isConnected = shopifyConnectionQuery.data?.connected || false;
  const shopName = shopifyConnectionQuery.data?.shopName || '';

  return (
    <Card className="overflow-hidden">
      {/* Modern Header with Better Status Indication */}
      <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-lg">Shopify Synchronization</CardTitle>
          </div>
          
          {/* Status Badge */}
          <Badge 
            variant={isSyncing ? "default" : isConnected ? "outline" : "destructive"}
            className={cn(
              "ml-2 px-2 py-0.5",
              isSyncing && "bg-blue-500 hover:bg-blue-500/90",
              isConnected && !isSyncing && "border-green-500 text-green-600 dark:text-green-500"
            )}
          >
            {isSyncing ? (
              <div className="flex items-center">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                <span>Syncing</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center">
                <XCircle className="h-3 w-3 mr-1" />
                <span>Disconnected</span>
              </div>
            )}
          </Badge>
        </div>
        
        {/* Store Information */}
        {isConnected && shopName && (
          <div className="flex items-center mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-blue-600 dark:text-blue-400">{shopName}</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {/* If not syncing, show last sync and run button */}
        {!isSyncing && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Last Sync</div>
                  <div className="text-sm text-muted-foreground">
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                    ) : (
                      formattedLastSync
                    )}
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleManualSync}
                disabled={!isConnected}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
            </div>
            
            {/* Info about what sync does */}
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p>Syncs products from your Shopify store and updates cost prices</p>
              </div>
              <div className="flex items-start gap-2">
                <BarChart2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p>Allows accurate price comparison and profit margin calculations</p>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p>Click "Sync Now" to begin a 3-step synchronization process</p>
              </div>
            </div>
          </div>
        )}
        
        {/* If syncing, show the 3-step process with visual timeline */}
        {isSyncing && (
          <div className="divide-y">
            {/* Process heading with summary */}
            <div className="p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400">
                  Shopify Sync in Progress
                </h3>
                <span className="text-sm font-medium">
                  {processedItems} items processed
                </span>
              </div>
              
              {/* Elapsed time and ETA */}
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {startTime && (
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1 inline" />
                    Running for {elapsedTime}
                  </span>
                )}
                
                {eta && (
                  <span className="flex items-center ml-3">
                    <CheckCircle className="h-3 w-3 mr-1 inline" />
                    ETA: {eta}
                  </span>
                )}
              </div>
            </div>
            
            {/* Visual 3-step process */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
              <div className="relative pb-2">
                {/* Vertical timeline connector */}
                <div className="absolute left-3 top-1 h-full w-0.5 bg-slate-200 dark:bg-slate-800" />
                
                {/* Step 1: Count Products */}
                <div className="relative mb-5">
                  <div className="flex items-start">
                    <div className={cn(
                      "z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 mr-3",
                      isStep1Active 
                        ? "border-blue-500 bg-blue-100 dark:bg-blue-900/30" 
                        : isComplete || processedItems > 0 
                          ? "border-green-500 bg-green-100 dark:bg-green-900/30" 
                          : "border-slate-300 bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                    )}>
                      {isStep1Active ? (
                        <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
                      ) : isComplete || processedItems > 0 ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <CircleDashed className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                    
                    <div className="pt-0.5">
                      <h4 className={cn(
                        "font-medium text-sm",
                        isStep1Active ? "text-blue-600 dark:text-blue-400" : ""
                      )}>
                        Step 1: Count Products
                      </h4>
                      
                      {isStep1Active && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Counting unique products in your Shopify store...
                        </p>
                      )}
                      
                      {uniqueProductCount > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-500 font-medium mt-1">
                          Found {uniqueProductCount} unique products
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Step 2: Process with ETA */}
                <div className="relative mb-5">
                  <div className="flex items-start">
                    <div className={cn(
                      "z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 mr-3",
                      isStep2Active 
                        ? "border-blue-500 bg-blue-100 dark:bg-blue-900/30" 
                        : isComplete || isStep3Active 
                          ? "border-green-500 bg-green-100 dark:bg-green-900/30" 
                          : "border-slate-300 bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                    )}>
                      {isStep2Active ? (
                        <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
                      ) : isComplete || isStep3Active ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <CircleDashed className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                    
                    <div className="pt-0.5">
                      <h4 className={cn(
                        "font-medium text-sm",
                        isStep2Active ? "text-blue-600 dark:text-blue-400" : ""
                      )}>
                        Step 2: Process with ETA
                      </h4>
                      
                      {isStep2Active && (
                        <div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Processing products and extracting cost prices...
                          </p>
                          
                          {processedItems > 0 && totalItems > 0 && (
                            <div className="flex justify-between mt-1 text-xs">
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {Math.round((processedItems / totalItems) * 100)}% Complete
                              </span>
                              <span className="text-muted-foreground">
                                {processedItems} of {totalItems} items
                              </span>
                            </div>
                          )}
                          
                          {/* Live Cost Price Feed - Simplified version, just showing the most recent */}
                          {costPriceLogs.length > 0 && (
                            <div className="mt-2 bg-white dark:bg-slate-900 border rounded-md overflow-hidden">
                              <ScrollArea className="h-[100px]">
                                <div className="p-1 space-y-0.5">
                                  {costPriceLogs.slice(0, 10).map((log, i) => (
                                    <div 
                                      key={`${log.sku}-${i}`} 
                                      className="p-1 text-xs flex justify-between bg-gray-50 dark:bg-slate-900/80 rounded"
                                    >
                                      <span className="font-mono text-blue-700 dark:text-blue-400">{log.sku}</span>
                                      <span className="font-medium text-green-600 dark:text-green-500">${log.price}</span>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Step 3: Complete */}
                <div className="relative">
                  <div className="flex items-start">
                    <div className={cn(
                      "z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 mr-3",
                      isStep3Active 
                        ? "border-blue-500 bg-blue-100 dark:bg-blue-900/30" 
                        : isComplete 
                          ? "border-green-500 bg-green-100 dark:bg-green-900/30" 
                          : "border-slate-300 bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                    )}>
                      {isStep3Active ? (
                        <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
                      ) : isComplete ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <CircleDashed className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                    
                    <div className="pt-0.5">
                      <h4 className={cn(
                        "font-medium text-sm",
                        isStep3Active ? "text-blue-600 dark:text-blue-400" : ""
                      )}>
                        Step 3: Completing Sync
                      </h4>
                      
                      {isStep3Active && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Finalizing data and completing the sync operation...
                        </p>
                      )}
                      
                      {isComplete && (
                        <p className="text-xs text-green-600 dark:text-green-500 font-medium mt-1">
                          Sync completed successfully!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Current status and controls */}
            <div className="p-4 flex justify-between items-center">
              <div className="text-xs text-muted-foreground max-w-[70%]">
                {progressMessage}
              </div>
              
              <Button 
                size="sm"
                variant="outline" 
                onClick={handleResetSync}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Cancel Sync
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}