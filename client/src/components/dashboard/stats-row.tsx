import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, ShoppingCart, CheckCheck, BarChart2, DollarSign, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function StatsRow() {
  // Fetch dashboard stats from API
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  // Fetch price discrepancies count
  const { data: discrepancies = [] } = useQuery({
    queryKey: ['/api/products/discrepancies'],
  });

  const statItems = [
    { 
      title: "TOTAL PRODUCTS", 
      icon: <ShoppingCart className="h-5 w-5 text-primary-500" />,
      value: stats?.productCount || 0,
      isMonetary: false,
      color: "text-gray-900",
      change: stats?.productCount ? { value: 0, positive: true } : null,
    },
    { 
      title: "PRICE CHECKS", 
      icon: <CheckCheck className="h-5 w-5 text-green-500" />,
      value: stats?.totalPriceChecks || 0,
      isMonetary: false,
      color: "text-gray-900",
      change: null,
    },
    { 
      title: "ACTIVE PRODUCTS",
      icon: <Truck className="h-5 w-5 text-blue-500" />,
      value: stats?.activeProductCount || 0,
      isMonetary: false,
      color: "text-gray-900",
      change: stats?.activeProductCount && stats?.productCount 
        ? { value: Math.round((stats.activeProductCount / stats.productCount) * 100), positive: true, percentage: true } 
        : null,
    },
    { 
      title: "PRICE DISCREPANCIES", 
      icon: <BarChart2 className="h-5 w-5 text-amber-500" />,
      value: discrepancies?.length || 0,
      isMonetary: false,
      color: "text-gray-900",
      change: null,
    },
  ];

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statItems.map((stat, index) => (
            <div key={index} className="p-6 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-gray-500 uppercase">{stat.title}</div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  {stat.icon}
                </div>
              </div>
              
              {isLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <>
                  <div className={`text-3xl font-bold ${stat.color}`}>
                    {stat.isMonetary ? `$${stat.value.toFixed(2)}` : stat.value.toLocaleString()}
                  </div>
                  
                  {stat.change && (
                    <div className="flex items-center mt-3">
                      <Badge variant={stat.change.positive ? "outline" : "destructive"} className={stat.change.positive ? "bg-green-50 text-green-700 hover:bg-green-50 border-green-100" : ""}>
                        <span className="flex items-center">
                          {stat.change.positive ? 
                            <ArrowUpRight className="h-3 w-3 mr-1" /> : 
                            <ArrowDownRight className="h-3 w-3 mr-1" />
                          }
                          {stat.change.value}{stat.change.percentage ? '%' : ''}
                        </span>
                      </Badge>
                      <span className="text-xs text-gray-500 ml-2">vs prev. period</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
