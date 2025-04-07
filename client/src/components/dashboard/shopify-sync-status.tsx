import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Clock, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function ShopifySyncStatus() {
  // Fetch scheduler status from API with aggressive refresh
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/scheduler/status"],
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch Shopify connection status with aggressive refresh
  const shopifyConnectionQuery = useQuery({
    queryKey: ["/api/shopify/status"],
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Formatted last sync time
  const lastSyncTime = data?.lastShopifySync 
    ? new Date(data.lastShopifySync) 
    : null;

  const formattedLastSync = lastSyncTime
    ? `${formatDistanceToNow(lastSyncTime)} ago (${format(lastSyncTime, "MMM d, yyyy h:mm a")})`
    : "Never";

  // Is Shopify sync job active
  const isShopifySyncActive = data?.activeJobs?.includes("hourly-shopify-sync") || false;

  // Handle manual sync
  const handleManualSync = async () => {
    try {
      const response = await fetch("/api/scheduler/run-shopify-sync", {
        method: "POST",
      });
      
      if (response.ok) {
        toast({
          title: "Sync started",
          description: "Shopify product sync has been initiated.",
        });
        
        // Refetch after a short delay to show updated status
        setTimeout(() => refetch(), 3000);
      } else {
        toast({
          title: "Sync failed",
          description: "Failed to start Shopify sync.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while trying to sync with Shopify.",
        variant: "destructive",
      });
    }
  };

  // Connection status
  const isConnected = shopifyConnectionQuery.data?.connected || false;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <RefreshCw className="h-5 w-5 mr-2 text-blue-500" />
          Shopify Sync Status
        </CardTitle>
        <CardDescription>
          Automatic product synchronization with Shopify
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Connection:</div>
            <div className="flex items-center">
              {shopifyConnectionQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : isConnected ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-red-500 mr-1"></div>
              )}
              <span className={isConnected ? "text-green-500" : "text-red-500"}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Sync Schedule:</div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 text-blue-500" />
              <span>{isShopifySyncActive ? "Every hour" : "Not scheduled"}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Last Sync:</div>
            <div className="text-sm font-medium">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                formattedLastSync
              )}
            </div>
          </div>
          
          <Button 
            size="sm"
            className="w-full mt-2" 
            onClick={handleManualSync}
            disabled={!isConnected}>
            Run Sync Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}