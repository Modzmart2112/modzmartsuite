import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { CheckSquare, Clock, FileUp, ShoppingCart, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityEvent {
  id: number;
  type: string;
  title: string;
  details: string;
  timestamp: string;
}

interface ActivityResponse {
  events: ActivityEvent[];
}

function getEventIcon(type: string) {
  switch (type) {
    case "csv_upload":
      return <FileUp className="w-4 h-4 mr-2 text-green-500" />;
    case "price_check":
      return <CheckSquare className="w-4 h-4 mr-2 text-blue-500" />;
    case "shopify_sync":
      return <ShoppingCart className="w-4 h-4 mr-2 text-purple-500" />;
    case "price_discrepancy":
      return <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />;
    default:
      return <Clock className="w-4 h-4 mr-2 text-gray-500" />;
  }
}

function getEventBadge(type: string) {
  switch (type) {
    case "csv_upload":
      return <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">Upload</Badge>;
    case "price_check":
      return <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">Price Check</Badge>;
    case "shopify_sync":
      return <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">Shopify Sync</Badge>;
    case "price_discrepancy":
      return <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200">Discrepancy</Badge>;
    default:
      return <Badge variant="outline" className="ml-2">Activity</Badge>;
  }
}

export function RecentActivityCard() {
  const { data, isLoading, error } = useQuery<ActivityResponse>({
    queryKey: ['/api/dashboard/activity'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return (
    <Card className="col-span-1 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold">Recent Activity</CardTitle>
        <CardDescription>Latest actions and system events</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array(5).fill(0).map((_, index) => (
              <div key={index} className="flex items-start space-x-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-4 text-center text-muted-foreground">
            Failed to load activity data
          </div>
        ) : data && data.events && data.events.length > 0 ? (
          <div className="space-y-4">
            {data.events.map((event: ActivityEvent) => (
              <div key={event.id} className="flex items-start space-y-1">
                <div className="flex-1">
                  <div className="flex items-center">
                    {getEventIcon(event.type)}
                    <h4 className="font-medium text-sm">
                      {event.title}
                      {getEventBadge(event.type)}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 ml-6">
                    {event.details}
                  </p>
                  <div className="flex items-center mt-1 ml-6">
                    <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground" title={format(new Date(event.timestamp), 'PPpp')}>
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No recent activity to display
          </div>
        )}
      </CardContent>
    </Card>
  );
}