import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { SiAmazon, SiEbay, SiWalmart } from "react-icons/si";

export function SalesChannels() {
  // Fetch dashboard stats from API
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  const channelIcons: Record<string, React.ReactNode> = {
    "Amazon": <SiAmazon className="h-8 w-8" />,
    "eBay": <SiEbay className="h-8 w-8" />,
    "Walmart": <SiWalmart className="h-8 w-8" />
  };

  const channelColors: Record<string, string> = {
    "Amazon": "bg-gradient-to-r from-[#FF9900] to-[#FFC266]",
    "eBay": "bg-gradient-to-r from-[#86B817] to-[#A6D44D]",
    "Walmart": "bg-gradient-to-r from-[#0071CE] to-[#4D9BDA]"
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-900">Top Sales Channel Summary</h2>
          <div className="text-sm text-gray-500 flex items-center">
            <span>Last 90 days</span>
            <button className="ml-2 text-gray-400 hover:text-gray-600" title="More info">
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {stats?.salesChannels?.map((channel: any, index: number) => (
              <div key={index} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {channelIcons[channel.name] || 
                      <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                        {channel.name.charAt(0)}
                      </div>
                    }
                    <span className="text-base font-medium text-gray-900 ml-2">{channel.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{channel.percentage.toFixed(2)}%</span>
                </div>
                
                <div className="relative w-full bg-gray-200 rounded-full h-4 mb-2">
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full ${channelColors[channel.name] || 'bg-gray-500'}`}
                    style={{ width: `${channel.percentage}%` }}
                  ></div>
                </div>
                
                <div className="text-xs text-gray-500">
                  {safeToLocaleString(channel.orders)} orders • {safeToLocaleString(channel.shipments)} shipments
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
