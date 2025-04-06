import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsRow() {
  // Fetch dashboard stats from API
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  const statItems = [
    { 
      title: "TOTAL ORDERS", 
      value: stats?.totalOrders || 0,
      isMonetary: false,
      color: "text-gray-900" 
    },
    { 
      title: "TODAY ORDERS", 
      value: stats?.todayOrders || 0,
      isMonetary: false,
      color: "text-gray-900" 
    },
    { 
      title: "AVERAGE ORDER PRICE", 
      value: stats?.averageOrderPrice || 0,
      isMonetary: true,
      color: "text-primary" 
    },
    { 
      title: "TOTAL SHIPMENTS", 
      value: stats?.totalShipments || 0,
      isMonetary: false,
      color: "text-gray-900" 
    },
    { 
      title: "TODAY SHIPMENTS", 
      value: stats?.todayShipments || 0,
      isMonetary: false,
      color: "text-gray-900" 
    },
    { 
      title: "TOTAL SHIPPING COST", 
      value: stats?.totalShippingCost || 0,
      isMonetary: true,
      color: "text-primary" 
    },
  ];

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {statItems.map((stat, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-500 uppercase">{stat.title}</div>
              {isLoading ? (
                <Skeleton className="h-8 w-24 mt-2" />
              ) : (
                <div className={`text-2xl font-bold mt-2 ${stat.color}`}>
                  {stat.isMonetary ? `$${stat.value.toFixed(2)}` : stat.value.toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
