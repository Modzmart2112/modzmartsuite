import { PriceDiscrepancyChart } from "@/components/dashboard/price-discrepancy-chart";
import { PriceDiscrepancyList } from "@/components/dashboard/price-discrepancies-list";
import { ProductsOverview } from "@/components/dashboard/products-overview";
import { StatsRow } from "@/components/dashboard/stats-row";
import { SchedulerStatus } from "@/components/dashboard/scheduler-status";
import { ShopifySyncStatus } from "@/components/dashboard/shopify-sync-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Upload, PlusCircle, Clock } from "lucide-react";

export default function Dashboard() {
  const handleOpenUploadModal = () => {
    document.dispatchEvent(new CustomEvent('open-csv-upload-modal'));
  };

  return (
    <div className="container-fluid mx-auto">
      {/* Header Section with Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 sm:mb-6">
        <h1 className="mobile-heading text-gray-900 mb-3 md:mb-0">Dashboard</h1>
        
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Button 
            variant="outline" 
            onClick={handleOpenUploadModal}
            className="flex items-center gap-2 touch-button sm:touch-button-none w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Supplier Data</span>
          </Button>

          <Link href="/suppliers" className="w-full sm:w-auto">
            <Button className="flex items-center gap-2 touch-button sm:touch-button-none w-full">
              <PlusCircle className="h-4 w-4" />
              <span>Manage Suppliers</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Products Overview at the top */}
      <div className="mb-4 sm:mb-6">
        <ProductsOverview />
      </div>

      {/* Price Discrepancy Chart - Full Width */}
      <div className="mb-4 sm:mb-6">
        <PriceDiscrepancyChart />
      </div>
      
      {/* Price Discrepancy List */}
      <div className="mb-4 sm:mb-6">
        <PriceDiscrepancyList />
      </div>
      
      {/* Bottom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <SchedulerStatus />
        <ShopifySyncStatus />
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">CSV uploaded: processed_APR Performance BAI 6.csv</p>
                  <p className="text-xs text-gray-500">58 products updated • Today at 7:18 AM</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Price check completed</p>
                  <p className="text-xs text-gray-500">558 products checked, 319 updated • Today at 7:24 AM</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
