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
  BarChart2, Zap, Check, CircleDashed,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function ShopifySyncStatus() {
  // State for cost price log entries
  const [costPriceLogs, setCostPriceLogs] = useState<Array<{ 
    sku: string, 
    price: string, 
    timestamp: Date,
    position?: number,
    totalProducts?: number 
  }>>([]);
  
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
  // Track the current sync ID to detect when a new sync starts
  const [currentSyncId, setCurrentSyncId] = useState<number | null>(null);
  
  useEffect(() => {
    // Check if we have a sync in progress
    const syncProgress = syncProgressQuery.data;
    const isSyncing = syncProgress && (syncProgress.status === 'pending' || syncProgress.status === 'in-progress');
    
    // Check if this is a new sync session (ID changed)
    const syncId = syncProgress?.id || null;
    const isNewSync = syncId !== currentSyncId;
    
    // Update the current sync ID when it changes
    if (isNewSync && syncId) {
      setCurrentSyncId(syncId);
      // Clear previous logs when a new sync starts
      setCostPriceLogs([]);
      console.log(`New sync session detected! ID: ${syncId}`);
    }
    
    if (isSyncing) {
      // Function to fetch the server logs via the API
      const fetchLogs = async () => {
        try {
          // Add the specific sync ID to the filter query to ensure we only get logs from this sync session
          const response = await fetch(`/api/logs/shopify?filterBySync=true&syncId=${syncProgress.id}`);
          if (response.ok) {
            const logsData = await response.json();
            
            // Parse logs for cost price information
            const newLogs: Array<{ 
              sku: string, 
              price: string, 
              timestamp: Date,
              position?: number,
              totalProducts?: number 
            }> = [];
            
            logsData.forEach((log: any) => {
              // First check if log has metadata from cost-logger module
              if (log.metadata && log.metadata.type === 'cost_price' && log.metadata.sku && log.metadata.price) {
                newLogs.push({
                  sku: log.metadata.sku,
                  price: log.metadata.price.toFixed(2),
                  timestamp: new Date(log.createdAt),
                  position: log.metadata.position || undefined,
                  totalProducts: log.metadata.totalProducts || undefined
                });
              } else {
                // Fall back to regex extraction - using a more specific pattern to match SyncID tags exactly
                // The pattern matches "Got cost price for SKU: $123.45 [SyncID: 123]" format
                const match = /Got cost price for ([A-Za-z0-9-]+): \$([\d.]+)(?:\s+\[SyncID: (\d+)\])?/.exec(log.message);
                if (match && match[1] && match[2]) {
                  // Check if the SyncID in the log matches the current syncProgress.id
                  const logSyncId = match[3] ? parseInt(match[3]) : null;
                  
                  // Only use this log if it either has no SyncID tag or it has the correct SyncID
                  // This ensures we don't show logs from other sync sessions
                  if (!syncProgress.id || !logSyncId || logSyncId === syncProgress.id) {
                    // Only include products with a valid cost price
                    const price = parseFloat(match[2]);
                    if (!isNaN(price) && price > 0) {
                      newLogs.push({
                        sku: match[1],
                        price: match[2],
                        timestamp: new Date(log.createdAt),
                        position: undefined,
                        totalProducts: undefined
                      });
                    }
                  }
                }
              }
            });
            
            // Using a replacement approach instead of merging to ensure we only show current sync logs
            if (newLogs.length > 0) {
              setCostPriceLogs(prevLogs => {
                // Start with just the new logs
                const combined = [...newLogs];
                
                // Remove duplicates by SKU (keep most recent)
                const uniqueLogs = combined.reduce((acc, current) => {
                  const x = acc.find(item => item.sku === current.sku);
                  if (!x) {
                    return acc.concat([current]);
                  } else {
                    return acc;
                  }
                }, [] as Array<{ 
                  sku: string, 
                  price: string, 
                  timestamp: Date,
                  position?: number,
                  totalProducts?: number
                }>);
                
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
  }, [syncProgressQuery.data, currentSyncId]);

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
  
  // FIXED: Recognize all valid states where we can start a sync
  // If a sync was just reset or is in "pending" but not actively started,
  // we should allow starting a new sync
  const isReady = !syncProgress || 
    syncProgress.status === 'ready' || 
    syncProgress.status === 'complete' || 
    syncProgress.status === 'reset' || 
    syncProgress.status === 'failed' ||
    (syncProgress.status === 'pending' && !syncProgress.message?.includes('Counting'));
  
  // Only consider actively syncing when we're actually running an operation
  const isSyncing = syncProgress && 
    ((syncProgress.status === 'pending' && syncProgress.message?.includes('Counting')) || 
     syncProgress.status === 'in-progress');
  
  // Progress message and counts
  const progressMessage = syncProgress?.message || 'Ready to sync';
  const processedItems = syncProgress?.processedItems || 0;
  const totalItems = syncProgress?.totalItems || 0;
  const uniqueProductCount = syncProgress?.details?.uniqueProductCount || 0;
  
  // Only show progress when sync is actually in progress and we have valid items
  // This prevents showing misleading percentage before sync starts
  const shouldShowProgress = isSyncing && totalItems > 0 && processedItems >= 0;
  
  // Use exact percentage when available, otherwise calculate
  // This ensures smoother progress display and prevents jumps
  const exactPercentage = syncProgress?.details?.percentage;
  const calculatedPercentage = shouldShowProgress && totalItems > 0 ? 
    (processedItems / totalItems) * 100 : 0;
  const progressPercentage = exactPercentage !== undefined ? 
    exactPercentage : calculatedPercentage;
  
  // For progress bar display, rounded to nearest integer, only show if we're syncing
  const displayPercentage = shouldShowProgress ? 
    Math.min(100, Math.round(progressPercentage)) : 0;
  
  // Display any extra debug info
  const processedDebug = syncProgress?.details?.processedDebug;
  const totalDebug = syncProgress?.details?.totalDebug;
  const batchSize = syncProgress?.details?.batchSize;
  const batchNumber = syncProgress?.details?.batchNumber;
  
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
      // Clear the cost price logs to start with a fresh view
      setCostPriceLogs([]);
      
      // First validate that we can actually start a sync
      if (!isReady) {
        toast({
          title: "Cannot Start Sync",
          description: "Please reset the current sync before starting a new one.",
          variant: "destructive",
        });
        return;
      }
      
      const response = await fetch("/api/scheduler/run-shopify-sync", {
        method: "POST",
      });
      
      if (response.ok) {
        toast({
          title: "Shopify Sync Started",
          description: "Product synchronization has been initiated",
        });
        
        // Refresh data after a short delay to ensure the backend has updated
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
  
  // Handle specialized cost price sync - only updates products without cost prices
  const handleCostPriceSync = () => {
    // Clear the cost price logs to start with a fresh view
    setCostPriceLogs([]);
    
    // First validate that we can actually start a sync
    if (!isReady) {
      toast({
        title: "Cannot Start Cost Price Sync",
        description: "Please reset the current sync before starting a new one.",
        variant: "destructive",
      });
      return;
    }
    
    // Show immediate feedback
    toast({
      title: "Starting Cost Price Sync",
      description: "Initializing synchronization...",
    });
    
    // Make a simple POST request - no complex error handling
    fetch("/api/scheduler/run-cost-price-sync", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' }
    })
      .then(() => {
        // Success - just show a success toast
        toast({
          title: "Cost Price Sync Started",
          description: "Syncing only products without cost prices"
        });
        
        // Refresh data to show new sync state
        refetch();
        syncProgressQuery.refetch();
      });
  };
  
  // Handler for syncing ONLY products missing cost prices
  const handleSyncMissingCostPrices = () => {
    // Clear cost price logs for a fresh view
    setCostPriceLogs([]);
    
    // First validate that we can actually start a sync
    if (!isReady) {
      toast({
        title: "Cannot Start Missing Cost Price Sync",
        description: "Please reset the current sync before starting a new one.",
        variant: "destructive",
      });
      return;
    }
    
    // Show immediate feedback
    toast({
      title: "Starting Missing Cost Price Sync",
      description: "Checking for products without cost prices...",
    });
    
    // Call the new dedicated endpoint
    fetch("/api/products/sync-missing-cost-prices", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' }
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            console.error("Error response from server:", text);
            throw new Error(`Server responded with status: ${response.status}`);
          });
        }
        return response.json();
      })
      .then(data => {
        // Success - show a toast with the count of affected products
        console.log("Sync missing cost prices success:", data);
        toast({
          title: "Missing Cost Price Sync Started",
          description: `Syncing ${data.missingCostPriceCount} products missing cost prices`
        });
        
        // Refresh data to show new sync state
        refetch();
        syncProgressQuery.refetch();
        
        // Simple polling to keep UI updated
        setTimeout(() => syncProgressQuery.refetch(), 500);
        setTimeout(() => syncProgressQuery.refetch(), 1500);
        setTimeout(() => syncProgressQuery.refetch(), 3000);
      })
      .catch((error) => {
        // Detailed error message on failure
        console.error("Error syncing missing cost prices:", error);
        toast({
          title: "Sync Failed",
          description: "Could not start cost price sync: " + error.message,
          variant: "destructive"
        });
      });
  };

  // Handle complete reset for stuck sync - forces a fresh start
  const handleResetSync = async () => {
    try {
      // Show confirmation toast before proceeding
      if (confirm('This will completely reset the sync process and create a fresh start. Continue?')) {
        const response = await fetch("/api/scheduler/reset-shopify-sync", {
          method: "POST",
        });
        
        if (response.ok) {
          const data = await response.json();
          toast({
            title: "Complete Reset Successful",
            description: "Created fresh sync record. Ready for new start.",
          });
          
          // Clear all UI state
          setCostPriceLogs([]);
          
          // Refresh data
          setTimeout(() => {
            refetch();
            syncProgressQuery.refetch();
            console.log("Sync fully reset - fresh ID created:", data?.details?.newSyncId);
          }, 500);
        } else {
          const errorData = await response.json();
          toast({
            title: "Reset Failed",
            description: errorData?.message || "Could not reset Shopify sync",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error performing complete reset:", error);
      toast({
        title: "Reset Error",
        description: "An error occurred during the complete reset process",
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
            <div className="p-3 bg-muted/50 rounded-md space-y-3 border border-border">
              {/* Top section with last sync info */}
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-muted-foreground mr-3" />
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
              
              {/* Button section with grid layout for better fit */}
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  onClick={handleSyncMissingCostPrices}
                  disabled={!isConnected}
                  variant="outline"
                  size="sm"
                  className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950"
                  title="Only sync products that are missing cost prices"
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span className="whitespace-nowrap text-xs">Fix Missing Costs</span>
                </Button>
                <Button 
                  onClick={handleCostPriceSync}
                  disabled={!isConnected}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  <span className="whitespace-nowrap text-xs">Cost Prices Only</span>
                </Button>
                <Button 
                  onClick={handleManualSync}
                  disabled={!isConnected}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  <span className="whitespace-nowrap text-xs">Sync All</span>
                </Button>
              </div>
            </div>
            
            <Separator className="my-3" />
            
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
                <p>"Sync All" for all products or "Cost Prices Only" for products missing cost prices</p>
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
                          
                          {shouldShowProgress && totalItems > 0 && (
                            <div className="mt-1 text-xs">
                              <span className="text-muted-foreground">
                                {processedItems} of {totalItems} items processed
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
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Complete Reset
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}