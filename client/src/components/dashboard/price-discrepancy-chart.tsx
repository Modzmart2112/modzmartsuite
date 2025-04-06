import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export function PriceDiscrepancyChart() {
  // Fetch dashboard stats from API
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  // Sample chart data - would come from API in real implementation
  const chartData = [
    { month: '1st', netSales: 140, cost: 160 },
    { month: '2nd', netSales: 120, cost: 150 },
    { month: '3rd', netSales: 100, cost: 140 },
    { month: '4th', netSales: 80, cost: 130 },
    { month: '5th', netSales: 75, cost: 125 },
    { month: '6th', netSales: 60, cost: 120 },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Price Discrepancies & Costs</h2>
          <span className="text-sm text-gray-500">Last 90 days</span>
        </div>
        
        <div className="flex items-start">
          <div className="flex-1">
            <div className="text-3xl font-bold text-gray-900">
              {isLoading ? '...' : `$${(stats?.totalRevenue / 1000).toFixed(2)}K`}
            </div>
            <div className="flex items-center mt-1">
              <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                +19.2%
              </Badge>
              <span className="text-xs text-gray-500 ml-2">vs prev. 90 days</span>
            </div>
          </div>
          
          <div className="w-1/2">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: number) => [`$${value}`, '']}
                    labelFormatter={() => ''}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                      padding: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="netSales" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 3 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#38BDF8" 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              {chartData.map((item) => (
                <div key={item.month}>{item.month}</div>
              ))}
            </div>
            
            <div className="flex items-center justify-center space-x-6 mt-4">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-primary rounded-full mr-1"></span>
                <span className="text-xs text-gray-500">Net sales</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-400 rounded-full mr-1"></span>
                <span className="text-xs text-gray-500">Cost</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
