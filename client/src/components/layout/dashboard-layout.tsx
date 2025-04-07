import { ReactNode } from "react";
import Navbar from "./navbar";
import { CsvUploadModal } from "@/modals/csv-upload-modal";
import { PriceDiscrepancyNotification } from "@/modals/price-discrepancy-notification";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen h-screen max-h-screen">
      <Navbar />
      
      {/* Main Content Area with improved mobile scrolling */}
      <ScrollArea className="flex-1 bg-gray-100">
        <main className="px-2 py-3 sm:p-4 md:p-6">
          {children}
        </main>
      </ScrollArea>
      
      {/* Global Modals */}
      <CsvUploadModal />
      <PriceDiscrepancyNotification />
    </div>
  );
}
