import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Info, RefreshCw, BarChart3, PieChart as PieChartIcon, Layers, ShoppingBag, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Product } from "@shared/schema";

// Interface for brand statistics
interface BrandStat {
  name: string;
  count: number;
  color: string;
  percentage: number;
}

// Format numbers with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Function to generate a vibrant gradient based on index
const getGradient = (index: number): string => {
  const gradients = [
    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // blue
    'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', // purple
    'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', // pink
    'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', // indigo
    'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', // orange
    'linear-gradient(135deg, #10b981 0%, #059669 100%)', // green
    'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', // rose
    'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', // sky
    'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', // teal
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // amber
    'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)', // lime
    'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', // violet
  ];
  
  return gradients[index % gradients.length];
};

// Function to generate a solid color based on index
const getColor = (index: number): string => {
  const colors = [
    '#3b82f6', // blue
    '#a855f7', // purple
    '#ec4899', // pink
    '#8b5cf6', // indigo
    '#f97316', // orange
    '#10b981', // green
    '#f43f5e', // rose
    '#0ea5e9', // sky
    '#14b8a6', // teal
    '#f59e0b', // amber
    '#84cc16', // lime
    '#6366f1', // violet
  ];
  
  return colors[index % colors.length];
};

export function ShopifyBrandDistribution() {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('bar');
  
  // Get shopify connection status
  const { data: connectionInfo, isLoading: isConnectionLoading } = useQuery<{ connected: boolean }>({
    queryKey: ['/api/shopify/status'],
  });
  
  const isConnected = connectionInfo?.connected;
  
  // Use the dedicated brands endpoint to get brand distribution data
  const { data: brandData, isLoading: isBrandsLoading, refetch } = useQuery<{name: string, count: number}[]>({
    queryKey: ['/api/shopify/brands'],
    enabled: isConnected, // Only run this query if Shopify is connected
  });
  
  // Get all products as a fallback
  const { data: productsData, isLoading: isProductsLoading } = useQuery<{products: Product[]}>({
    queryKey: ['/api/products'],
    enabled: !brandData // Only run this query if brandData is not available
  });
  
  // Determine which data source to use
  const products = productsData?.products || [];
  
  // Process data to get brand statistics
  let brandStats: Record<string, number> = {};
  
  // If we have dedicated brand data from API, use it
  if (brandData) {
    brandData.forEach(brand => {
      brandStats[brand.name] = brand.count;
    });
  } else {
    // Fallback to processing products if brand data isn't available
    brandStats = products.reduce((stats: Record<string, number>, product: Product) => {
      // Use vendor as the brand name, or fallback to product type if vendor is missing
      const brand = product.vendor || product.productType || 'Unknown';
      
      if (!stats[brand]) {
        stats[brand] = 0;
      }
      
      stats[brand]++;
      return stats;
    }, {});
  }
  
  // Calculate total products
  const totalProducts = Object.values(brandStats).reduce((sum, count) => sum + count, 0);
  
  // Convert to array format for the chart with percentages
  const chartData: BrandStat[] = Object.entries(brandStats)
    .map(([name, count], index) => ({
      name,
      count,
      color: getColor(index),
      percentage: totalProducts > 0 ? (count / totalProducts) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count) // Sort by count in descending order
    .slice(0, 12); // Only show top 12 brands
  
  if (isConnectionLoading || isBrandsLoading || (isProductsLoading && !brandData)) {
    return (
      <Card className="shadow-md">
        <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16 mt-1" />
            </div>
            
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16 mt-1" />
            </div>
            
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20 mt-1" />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="h-[350px] mt-8 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <RefreshCw className="animate-spin h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Loading brand distribution data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!isConnected) {
    return (
      <Card className="shadow-md overflow-hidden border-0">
        <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
          <div className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle className="text-lg">Products by Brand</CardTitle>
              <CardDescription>Connect to Shopify to view your brand distribution</CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center justify-center h-[400px]">
          <div className="text-center">
            <div className="bg-blue-50 rounded-full p-6 inline-block">
              <BarChart3 size={48} className="text-blue-500" />
            </div>
            <h3 className="mt-6 text-lg font-medium">Shopify Connection Required</h3>
            <p className="mt-2 text-gray-500 max-w-md">
              Connect your Shopify store to visualize product distribution by brand and access powerful analytics
            </p>
            <Button className="mt-6" variant="default" asChild>
              <a href="/settings">Configure Shopify Connection</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-md overflow-hidden border-0">
      <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle className="text-lg">Products by Brand</CardTitle>
              <CardDescription>Distribution of products across manufacturers in your Shopify store</CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 rounded-full" 
              onClick={() => refetch()}
              title="Refresh data"
            >
              <RefreshCw size={16} />
            </Button>
            
            <div className="flex rounded-md overflow-hidden border">
              <Button 
                variant={chartType === 'bar' ? 'default' : 'ghost'}
                className="h-8 px-3 py-1 rounded-none flex items-center gap-1 text-xs" 
                onClick={() => setChartType('bar')}
              >
                <BarChart3 size={14} />
                Bar
              </Button>
              <Button 
                variant={chartType === 'pie' ? 'default' : 'ghost'}
                className="h-8 px-3 py-1 rounded-none flex items-center gap-1 text-xs" 
                onClick={() => setChartType('pie')}
              >
                <PieChartIcon size={14} />
                Pie
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 rounded-lg border border-blue-100 dark:border-blue-900 shadow-sm">
            <div className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center">
              <Layers className="h-4 w-4 mr-1.5" />
              Total Brands
            </div>
            <div className="text-3xl font-bold mt-2 text-blue-900 dark:text-blue-300">{Object.keys(brandStats).length}</div>
            <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1.5">From Shopify catalog</div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 p-5 rounded-lg border border-purple-100 dark:border-purple-900 shadow-sm">
            <div className="text-sm font-medium text-purple-700 dark:text-purple-400 flex items-center">
              <ShoppingBag className="h-4 w-4 mr-1.5" />
              Total Products
            </div>
            <div className="text-3xl font-bold mt-2 text-purple-900 dark:text-purple-300">{formatNumber(totalProducts)}</div>
            <div className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-1.5">Across all brands</div>
          </div>
          
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-5 rounded-lg border border-emerald-100 dark:border-emerald-900 shadow-sm">
            <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center">
              <Award className="h-4 w-4 mr-1.5" />
              Top Brand
            </div>
            <div className="text-3xl font-bold mt-2 text-emerald-900 dark:text-emerald-300">
              {chartData.length > 0 ? chartData[0].name : 'N/A'}
            </div>
            <div className="flex items-center mt-1.5">
              {chartData.length > 0 && (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs px-2.5 py-0.5">
                  {formatNumber(chartData[0].count)} products
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="h-[350px] mt-8">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'pie' ? (
              <PieChart>
                <defs>
                  {chartData.map((entry, index) => (
                    <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={getColor(index)} stopOpacity={0.9}/>
                      <stop offset="100%" stopColor={getColor(index)} stopOpacity={0.6}/>
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={130}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="name"
                  label={({ name, percent }) => (percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : '')}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#pieGradient-${index})`} stroke="#fff" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${formatNumber(value)} products (${props.payload.percentage.toFixed(1)}%)`, 
                    'Count'
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    color: '#fff',
                    borderRadius: '4px', 
                    border: 'none',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    padding: '8px 12px'
                  }}
                />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value, entry, index) => (
                    <span style={{ color: getColor(index as number), fontWeight: 500 }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            ) : (
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 30,
                  left: 20,
                  bottom: 10,
                }}
              >
                <defs>
                  {chartData.map((entry, index) => (
                    <linearGradient key={`gradient-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={getColor(index)} stopOpacity={0.9}/>
                      <stop offset="100%" stopColor={getColor(index)} stopOpacity={0.7}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => formatNumber(value)}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#666' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={140}
                  tick={{ fontSize: 12, fill: '#666' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${formatNumber(value)} products (${props.payload.percentage.toFixed(1)}%)`, 
                    'Count'
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    color: '#fff',
                    borderRadius: '4px', 
                    border: 'none',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    padding: '8px 12px'
                  }}
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                />
                <Bar 
                  dataKey="count" 
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#barGradient-${index})`} 
                      style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.1))' }} 
                    />
                  ))}
                  <LabelList 
                    dataKey="count" 
                    position="insideRight" 
                    style={{ fill: 'white', fontSize: 12, fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                    formatter={(value: number) => formatNumber(value)}
                  />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        
        <div className="flex items-center justify-between mt-6 bg-gray-50 p-3 rounded-lg">
          <div className="flex flex-wrap gap-2 items-center">
            {chartData.slice(0, 5).map((brand, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="flex items-center gap-1 py-1"
                style={{ backgroundColor: `${getColor(index)}15`, color: getColor(index), borderColor: `${getColor(index)}30` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(index) }}></span>
                {brand.name}
              </Badge>
            ))}
            {chartData.length > 5 && (
              <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                +{chartData.length - 5} more
              </Badge>
            )}
          </div>
          
          <div className="flex items-center text-xs text-gray-500">
            <Info size={14} className="mr-1" />
            Data from connected Shopify store
          </div>
        </div>
      </CardContent>
    </Card>
  );
}