import { PriceDiscrepancyChart } from "@/components/dashboard/price-discrepancy-chart";
import { PriceDiscrepancyList } from "@/components/dashboard/price-discrepancies-list";
import { ProductsOverview } from "@/components/dashboard/products-overview";
import { StatsRow } from "@/components/dashboard/stats-row";
import { SchedulerStatus } from "@/components/dashboard/scheduler-status";
import { ShopifySyncStatus } from "@/components/dashboard/shopify-sync-status";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
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
        <RecentActivityCard />
      </div>
    </div>
  );
}
