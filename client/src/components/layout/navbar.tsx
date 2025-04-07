import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Search,
  HelpCircle, 
  Settings, 
  Bell,
  Store,
  LogOut,
  User,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  BookOpen,
  Video,
  Mail,
  AlertTriangle,
  Info,
  Tag as TagIcon
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

type SearchResult = {
  id: number;
  sku: string;
  title: string;
  shopifyPrice: number;
  supplierPrice: number | null;
  hasPriceDiscrepancy: boolean;
};

type ConnectionStatus = {
  connected: boolean;
  shopName: string;
  lastSync: string | null;
};

export default function Navbar() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // For handling notifications
  const notifications = [
    {
      id: 1,
      title: "Price Discrepancy Detected",
      message: "APR Performance FRONT BRAKE COOLING DUCTS - MITSUBISHI LANCER EVOLUTION X 08-15 has a 15% price increase",
      time: "10 minutes ago",
      type: "price-increase",
      read: false
    },
    {
      id: 2,
      title: "Price Decrease Alert",
      message: "Bilstein B8 STRUTS/SHOCKS FRONT & REAR KIT - SUBARU WRX/STI 15-19 has decreased by 5%",
      time: "2 hours ago",
      type: "price-decrease",
      read: false
    },
    {
      id: 3,
      title: "Shopify Sync Completed",
      message: "Successfully synced 1604 products with your Shopify store",
      time: "Yesterday",
      type: "sync",
      read: true
    }
  ];
  
  // For Shopify connection status in profile menu
  const { data: shopifyConnection } = useQuery<ConnectionStatus>({
    queryKey: ['/api/shopify/connection-status'],
    refetchInterval: 300000, // Refetch every 5 minutes
    refetchOnWindowFocus: false,
  });
  
  const navItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5 mr-2" /> },
    { path: "/products", label: "Products", icon: <ShoppingBag className="h-5 w-5 mr-2" /> },
    { path: "/suppliers", label: "Suppliers", icon: <Users className="h-5 w-5 mr-2" /> },
    { path: "/sales", label: "Sales", icon: <TagIcon className="h-5 w-5 mr-2" /> },
    { path: "/settings", label: "Settings", icon: <Settings className="h-5 w-5 mr-2" /> },
  ];
  
  // Fetch search results as user types
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }
      
      try {
        // Use direct fetch to simplify debugging
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }
        
        const results = await response.json();
        console.log('Search results:', results);
        
        setSearchResults(results || []);
        // Show results if we have any, or if the query is long enough to show "no results" message
        setShowSearchResults(true);
      } catch (error) {
        console.error("Error searching products:", error);
        setSearchResults([]);
      }
    };
    
    const debounce = setTimeout(() => {
      fetchSearchResults();
    }, 300); // Debounce search requests
    
    return () => clearTimeout(debounce);
  }, [searchQuery]);
  
  // Handle clicks outside search results to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Show search results dropdown when user focuses on search input
  const handleSearchFocus = () => {
    // Always show search results dropdown on focus if there's a query
    if (searchQuery.length >= 2) {
      setShowSearchResults(true);
    }
  };
  
  // Handle notification click
  const handleNotificationClick = (notification: any) => {
    setSelectedNotification(notification);
    setNotificationDialogOpen(true);
  };
  
  // Format price with currency
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return `$${price.toFixed(2)}`;
  };

  return (
    <header>
      {/* Top navigation bar */}
      <div className="bg-primary text-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 mr-6">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <img 
                src="/logo.png" 
                alt="MODZ MART" 
                className="h-10" 
              />
            </div>
            
            {/* Divider between logo and search */}
            <div className="h-8 w-px bg-white/25 mx-4"></div>
            
            {/* Search with dropdown results */}
            <div className="relative hidden md:block flex-1" ref={searchRef}>
              <Input
                type="text"
                placeholder="Search products by SKU or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                className="w-full bg-gray-700 bg-opacity-50 rounded-full py-2 px-4 pl-10 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg max-h-80 overflow-y-auto">
                  <ul className="py-1 text-sm text-gray-700">
                    {searchResults.map((result) => (
                      <li key={result.id}>
                        <Link 
                          href={`/products/${result.id}`}
                          onClick={() => setShowSearchResults(false)}
                          className="block px-4 py-2 hover:bg-gray-100"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{result.title}</div>
                              <div className="text-xs text-gray-500">SKU: {result.sku}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{formatPrice(result.shopifyPrice)}</div>
                              {result.hasPriceDiscrepancy && (
                                <Badge variant="destructive" className="text-xs">Price Discrepancy</Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* No Results Message */}
              {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg">
                  <div className="py-4 px-4 text-center text-gray-500">
                    No products found matching "{searchQuery}"
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Side Icons */}
          <div className="flex items-center space-x-4">
            {/* Help Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="text-gray-300 hover:text-white"
                    onClick={() => setHelpDialogOpen(true)}
                  >
                    <HelpCircle className="h-6 w-6" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Help & Documentation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Settings Dropdown */}
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button className="text-gray-300 hover:text-white">
                        <Settings className="h-6 w-6" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Quick Settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Quick Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/settings">
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings?tab=preferences">
                  <DropdownMenuItem>
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Notification Preferences</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings?tab=shopify">
                  <DropdownMenuItem>
                    <Store className="mr-2 h-4 w-4" />
                    <span>Shopify Connection</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings?tab=telegram">
                  <DropdownMenuItem>
                    <Mail className="mr-2 h-4 w-4" />
                    <span>Telegram Settings</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Divider between settings and notifications */}
            <div className="h-8 w-px bg-white/25"></div>
            
            {/* Notifications Dropdown */}
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button className="text-gray-300 hover:text-white relative">
                        <Bell className="h-6 w-6" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {notifications.filter(n => !n.read).length}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Notifications</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex justify-between">
                  <span>Notifications</span>
                  {notifications.filter(n => !n.read).length > 0 && (
                    <button 
                      className="text-sm text-primary hover:underline"
                      onClick={() => toast({ title: "Marked all as read" })}
                    >
                      Mark all as read
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="py-4 text-center text-gray-500">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem 
                      key={notification.id}
                      className="cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start w-full">
                        <div className={`mt-0.5 mr-2 flex-shrink-0 ${
                          notification.type === 'price-increase' ? 'text-red-500' : 
                          notification.type === 'price-decrease' ? 'text-green-500' : 'text-blue-500'
                        }`}>
                          {notification.type === 'price-increase' ? (
                            <AlertCircle className="h-5 w-5" />
                          ) : notification.type === 'price-decrease' ? (
                            <Info className="h-5 w-5" />
                          ) : (
                            <CheckCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {notification.time}
                            </span>
                          </div>
                          <p className={`text-sm ${!notification.read ? 'text-gray-700' : 'text-gray-500'} line-clamp-2`}>
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <Link href="/notifications">
                  <DropdownMenuItem>
                    <span className="mx-auto text-sm text-primary">View all notifications</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <span className="ml-2 hidden md:block">John Doe</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">John Doe</p>
                  <p className="text-xs text-gray-500">admin@modz-mart.com</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Shopify Store</DropdownMenuLabel>
                <div className="px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm">{shopifyConnection?.shopName || "Modz Mart"}</p>
                    <Badge variant={shopifyConnection?.connected ? "success" : "destructive"} className="text-xs">
                      {shopifyConnection?.connected ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>
                  {shopifyConnection?.lastSync && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last sync: {new Date(shopifyConnection.lastSync).toLocaleString()}
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <User className="mr-2 h-4 w-4" />
                    <span>My Account</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <a href="https://modz-mart.myshopify.com/admin" target="_blank" rel="noopener noreferrer" className="flex items-center w-full">
                    <Store className="mr-2 h-4 w-4" />
                    <span>Open Shopify</span>
                    <ExternalLink className="ml-auto h-3 w-3" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toast({ title: "Logged Out", description: "You have been logged out" })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-primary/90 border-t border-gray-700">
        <div className="container mx-auto px-4">
          <nav className="flex overflow-x-auto no-scrollbar">
            {navItems.map((item, index) => (
              <div key={item.path} className="relative flex items-center">
                {index > 0 && (
                  <div className="absolute h-8 w-px bg-white/25 left-0 top-1/2 -translate-y-1/2"></div>
                )}
                <Link 
                  href={item.path}
                  className={`flex items-center px-6 py-4 text-white font-medium relative ${
                    location === item.path 
                      ? "after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-0 after:border-l-[6px] after:border-r-[6px] after:border-b-[6px] after:border-l-transparent after:border-r-transparent after:border-b-white" 
                      : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </div>
            ))}
          </nav>
        </div>
      </div>
      
      {/* Help Dialog */}
      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Help & Documentation</DialogTitle>
            <DialogDescription>
              Get help and learn how to use the Shopify Price Tracker application.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6">
            <div className="grid gap-4">
              <div className="rounded-lg border p-4">
                <h3 className="flex items-center text-lg font-semibold mb-2">
                  <BookOpen className="h-5 w-5 mr-2 text-primary" />
                  Documentation
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Read detailed guides and reference materials about using the application.
                </p>
                <Button variant="outline" className="w-full" onClick={() => 
                  toast({ title: "Documentation", description: "Opening documentation..." })
                }>
                  View Documentation
                </Button>
              </div>
              
              <div className="rounded-lg border p-4">
                <h3 className="flex items-center text-lg font-semibold mb-2">
                  <Video className="h-5 w-5 mr-2 text-primary" />
                  Video Tutorials
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Watch step-by-step video tutorials to learn how to use the platform.
                </p>
                <Button variant="outline" className="w-full" onClick={() => 
                  toast({ title: "Video Tutorials", description: "Opening video tutorials..." })
                }>
                  Watch Tutorials
                </Button>
              </div>
              
              <div className="rounded-lg border p-4">
                <h3 className="flex items-center text-lg font-semibold mb-2">
                  <AlertTriangle className="h-5 w-5 mr-2 text-primary" />
                  Troubleshooting
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Find solutions to common issues and troubleshooting guides.
                </p>
                <Button variant="outline" className="w-full" onClick={() => 
                  toast({ title: "Troubleshooting", description: "Opening troubleshooting guides..." })
                }>
                  View Troubleshooting
                </Button>
              </div>
            </div>
            
            <div className="rounded-lg border bg-gray-50 p-4">
              <h3 className="text-base font-semibold mb-1">Need more help?</h3>
              <p className="text-sm text-gray-600 mb-3">
                Contact our support team and we'll get back to you as soon as possible.
              </p>
              <Button className="w-full" onClick={() => 
                toast({ title: "Support Request", description: "Opening support contact form..." })
              }>
                Contact Support
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Notification Dialog */}
      <Dialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
        {selectedNotification && (
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                {selectedNotification.type === 'price-increase' ? (
                  <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
                ) : selectedNotification.type === 'price-decrease' ? (
                  <Info className="h-5 w-5 mr-2 text-green-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2 text-blue-500" />
                )}
                {selectedNotification.title}
              </DialogTitle>
              <DialogDescription className="text-right text-xs">
                {selectedNotification.time}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <p>{selectedNotification.message}</p>
              
              {selectedNotification.type === 'price-increase' || selectedNotification.type === 'price-decrease' ? (
                <div className="flex space-x-2 mt-4">
                  <Button className="flex-1" onClick={() => {
                    setNotificationDialogOpen(false);
                    toast({ title: "Action taken", description: "Navigating to product details" });
                  }}>View Product</Button>
                  <Button variant="outline" className="flex-1" onClick={() => {
                    setNotificationDialogOpen(false);
                    toast({ title: "Action taken", description: "Discrepancy has been cleared" });
                  }}>Clear Discrepancy</Button>
                </div>
              ) : (
                <Button className="w-full" onClick={() => setNotificationDialogOpen(false)}>
                  Close
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </header>
  );
}
