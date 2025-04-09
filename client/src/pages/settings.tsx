import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ShopifyConnectionInfo, TelegramConnectionInfo, AccountSettings } from "@shared/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Settings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePicture, setProfilePicture] = useState<string>("");
  const [accountInfo, setAccountInfo] = useState<AccountSettings>({
    username: "admin",
    firstName: "",
    lastName: "",
    email: "",
  });
  const [shopifyInfo, setShopifyInfo] = useState<ShopifyConnectionInfo>({
    shopifyApiKey: "",
    shopifyApiSecret: "",
    shopifyStoreUrl: "",
  });
  
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const [telegramInfo, setTelegramInfo] = useState<TelegramConnectionInfo>({
    telegramChatId: "",
  });
  
  // Query to get the user profile
  const profileQuery = useQuery({
    queryKey: ['/api/user/profile'],
    queryFn: async () => {
      const response = await fetch('/api/user/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      return response.json();
    }
  });
  
  // Update account info when profile data changes
  useEffect(() => {
    if (profileQuery.data) {
      setAccountInfo({
        username: profileQuery.data.username,
        firstName: profileQuery.data.firstName || '',
        lastName: profileQuery.data.lastName || '',
        email: profileQuery.data.email || '',
      });
      setProfilePicture(profileQuery.data.profilePicture || '');
    }
  }, [profileQuery.data]);
  
  // Query to check the connection status
  const connectionStatusQuery = useQuery({
    queryKey: ['/api/shopify/status'],
    queryFn: async () => {
      const response = await fetch('/api/shopify/status');
      if (!response.ok) {
        throw new Error('Failed to fetch connection status');
      }
      return response.json();
    }
  });
  
  // Update isConnected when the query data changes
  useEffect(() => {
    if (connectionStatusQuery.data) {
      setIsConnected(connectionStatusQuery.data.connected);
    }
  }, [connectionStatusQuery.data]);

  const shopifyMutation = useMutation({
    mutationFn: async (data: ShopifyConnectionInfo) => {
      const res = await apiRequest("POST", "/api/shopify/connect", data);
      return res.json();
    },
    onSuccess: () => {
      setIsConnected(true);
      toast({
        title: "Shopify Connected",
        description: "Your Shopify store has been successfully connected.",
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Shopify.",
        variant: "destructive",
      });
    },
  });
  
  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shopify/sync");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync Started",
        description: "Products are being synced from your Shopify store. This may take a few minutes.",
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync products from Shopify.",
        variant: "destructive",
      });
    },
  });

  const telegramMutation = useMutation({
    mutationFn: async (data: TelegramConnectionInfo) => {
      const res = await apiRequest("POST", "/api/telegram/connect", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Telegram Connected",
        description: "Your Telegram notifications have been successfully set up.",
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Telegram.",
        variant: "destructive",
      });
    },
  });
  
  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: async (data: AccountSettings) => {
      try {
        console.log("Submitting profile data:", JSON.stringify(data));
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API error: ${res.status} - ${errorText}`);
        }
        
        return res.json();
      } catch (err) {
        console.error("Profile update fetch error:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("Profile update success:", data);
      // Update local state
      setAccountInfo({
        username: data.user.username,
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        email: data.user.email || '',
      });
      
      // Force refetch profile data
      profileQuery.refetch();
      
      toast({
        title: "Profile Updated",
        description: "Your account details have been successfully updated.",
      });
    },
    onError: (error: any) => {
      console.error("Profile update error:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update your profile.",
        variant: "destructive",
      });
    },
  });
  
  // Profile picture upload mutation
  const profilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await fetch('/api/user/profile-picture', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('Failed to upload profile picture');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // Set the profile picture path directly - our enhanced avatar component handles caching
      setProfilePicture(data.profilePicture);
      
      // Also force refetch to ensure UI is consistent
      profileQuery.refetch();
      
      console.log("Profile picture updated:", data.profilePicture);
      
      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been successfully updated.",
      });
    },
    onError: (error) => {
      console.error("Profile picture upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload profile picture.",
        variant: "destructive",
      });
    },
  });

  const handleShopifyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShopifyInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleTelegramChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTelegramInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleShopifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    shopifyMutation.mutate(shopifyInfo);
  };

  const handleTelegramSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    telegramMutation.mutate(telegramInfo);
  };
  
  const handleSyncProducts = () => {
    syncProductsMutation.mutate();
  };
  
  // Handle account form changes
  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountInfo((prev) => ({ ...prev, [name]: value }));
  };
  
  // Handle account form submission
  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting account form with data:", accountInfo);
    
    // Ensure we're sending complete data
    const updatedAccountInfo = {
      ...accountInfo,
      username: accountInfo.username || profileQuery.data?.username || 'admin',
    };
    
    profileMutation.mutate(updatedAccountInfo);
  };
  
  // Handle profile picture upload
  const handleProfilePictureClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      profilePictureMutation.mutate(file);
    }
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 md:mb-0">Settings</h1>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList className="mb-6">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        
        <TabsContent value="integrations">
          <div className="grid grid-cols-1 gap-6">
            {/* Shopify Integration */}
            <Card>
              <CardHeader>
                <CardTitle>Shopify Integration</CardTitle>
                <CardDescription>
                  Connect your Shopify store to sync products and monitor prices.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 bg-blue-50 rounded-md border border-blue-100">
                  <h4 className="font-medium text-blue-700 mb-2">How to get your Shopify credentials</h4>
                  <ol className="space-y-2 text-sm text-blue-700">
                    <li>1. Log in to your Shopify admin panel</li>
                    <li>2. Go to Settings &gt; Apps and sales channels</li>
                    <li>3. Click "Develop apps" (or "Develop apps for your store")</li>
                    <li>4. Create a new app and name it "PriceSync"</li>
                    <li>5. In your app, go to "API credentials" and click "Configure Admin API access scopes"</li>
                    <li>6. Select <strong>read_products</strong> and <strong>write_products</strong> permissions</li>
                    <li>7. Install the app in your store when prompted</li>
                    <li>8. After installation, you will see your "Admin API access token" (this is the API Secret)</li>
                  </ol>
                </div>
                {isConnected && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-md">
                    <p className="text-sm text-green-700 flex items-center">
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Your Shopify store is connected
                    </p>
                  </div>
                )}
                
                <form onSubmit={handleShopifySubmit}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shopifyStoreUrl">Store URL</Label>
                        <Input
                          id="shopifyStoreUrl"
                          name="shopifyStoreUrl"
                          placeholder="your-store.myshopify.com"
                          value={shopifyInfo.shopifyStoreUrl}
                          onChange={handleShopifyChange}
                          required
                        />
                        <p className="text-xs text-gray-500">Example: mystore.myshopify.com (without https://)</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="shopifyApiKey">API Key</Label>
                        <Input
                          id="shopifyApiKey"
                          name="shopifyApiKey"
                          placeholder="Your Shopify API Key"
                          value={shopifyInfo.shopifyApiKey}
                          onChange={handleShopifyChange}
                          required
                        />
                        <p className="text-xs text-gray-500">Example: 7d5f36d57d5f36d57d5f36d57d5f36d5 (found in the API credentials section)</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="shopifyApiSecret">Admin API Access Token</Label>
                        <Input
                          id="shopifyApiSecret"
                          name="shopifyApiSecret"
                          type="password"
                          placeholder="Your Admin API Access Token"
                          value={shopifyInfo.shopifyApiSecret}
                          onChange={handleShopifyChange}
                          required
                        />
                        <p className="text-xs text-gray-500">Example: shpat_a123456789abcdef123456789abcdef</p>
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={shopifyMutation.isPending}>
                      {shopifyMutation.isPending ? "Connecting..." : "Connect Shopify"}
                    </Button>
                  </div>
                </form>
                
                {isConnected && (
                  <div className="mt-6 border-t pt-6">
                    <h3 className="text-lg font-medium mb-3">Manage Products</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Sync your Shopify products to monitor prices and track discrepancies.
                    </p>
                    <Button 
                      onClick={handleSyncProducts} 
                      disabled={syncProductsMutation.isPending}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      {syncProductsMutation.isPending ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Syncing Products...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 21h5v-5" />
                          </svg>
                          Sync Products from Shopify
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Telegram Notifications */}
            <Card>
              <CardHeader>
                <CardTitle>Telegram Notifications</CardTitle>
                <CardDescription>
                  Set up Telegram notifications for price discrepancies.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTelegramSubmit}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telegramChatId">Telegram Chat ID</Label>
                        <Input
                          id="telegramChatId"
                          name="telegramChatId"
                          placeholder="Your Telegram Chat ID"
                          value={telegramInfo.telegramChatId}
                          onChange={handleTelegramChange}
                          required
                        />
                        <p className="text-sm text-gray-500">
                          You can get your Chat ID by messaging @userinfobot on Telegram.
                        </p>
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={telegramMutation.isPending}>
                      {telegramMutation.isPending ? "Connecting..." : "Set Up Notifications"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="preferences">
          {/* Theme Preferences Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Theme Preferences</CardTitle>
              <CardDescription>
                Customize the appearance of the application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Import the ThemeSelector component */}
              <ThemeSelector />
            </CardContent>
          </Card>

          {/* Notification Preferences Card */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how and when you receive price discrepancy notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                toast({
                  title: "Preferences Updated",
                  description: "Your notification preferences have been saved."
                });
              }}>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-3">Price Change Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="priceIncreaseNotify">Price Increases</Label>
                          <p className="text-sm text-gray-500">
                            Get notified when supplier prices increase
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Label className="sr-only" htmlFor="priceIncreaseNotify">
                            Price Increases
                          </Label>
                          <input
                            type="checkbox"
                            id="priceIncreaseNotify"
                            className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded"
                            defaultChecked
                          />
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="priceDecreaseNotify">Price Decreases</Label>
                          <p className="text-sm text-gray-500">
                            Get notified when supplier prices decrease
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Label className="sr-only" htmlFor="priceDecreaseNotify">
                            Price Decreases
                          </Label>
                          <input
                            type="checkbox"
                            id="priceDecreaseNotify"
                            className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded"
                            defaultChecked
                          />
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="priceThresholdPercent">Minimum Price Change Threshold</Label>
                          <p className="text-sm text-gray-500">
                            Only notify for price changes above this percentage
                          </p>
                        </div>
                        <div className="flex items-center w-24">
                          <Input
                            id="priceThresholdPercent"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            defaultValue="1.0"
                            className="w-full"
                          />
                          <span className="ml-2">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-3">Notification Methods</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="telegramEnabled">Telegram</Label>
                          <p className="text-sm text-gray-500">
                            Receive notifications via Telegram bot
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Label className="sr-only" htmlFor="telegramEnabled">
                            Telegram
                          </Label>
                          <input
                            type="checkbox"
                            id="telegramEnabled"
                            className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded"
                            defaultChecked
                          />
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="emailEnabled">Email</Label>
                          <p className="text-sm text-gray-500">
                            Receive notifications via email
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Label className="sr-only" htmlFor="emailEnabled">
                            Email
                          </Label>
                          <input
                            type="checkbox"
                            id="emailEnabled"
                            className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded"
                          />
                        </div>
                      </div>
                      <div className="pt-2">
                        <Label htmlFor="emailAddress">Email Address</Label>
                        <Input
                          id="emailAddress"
                          type="email"
                          placeholder="you@example.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-3">Additional Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="dailySummary">Daily Summary</Label>
                          <p className="text-sm text-gray-500">
                            Receive a daily summary of all price changes
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Label className="sr-only" htmlFor="dailySummary">
                            Daily Summary
                          </Label>
                          <input
                            type="checkbox"
                            id="dailySummary"
                            className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded"
                            defaultChecked
                          />
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="notifyOutOfStock">Out of Stock Alerts</Label>
                          <p className="text-sm text-gray-500">
                            Get notified when supplier products go out of stock
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Label className="sr-only" htmlFor="notifyOutOfStock">
                            Out of Stock Alerts
                          </Label>
                          <input
                            type="checkbox"
                            id="notifyOutOfStock"
                            className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded"
                            defaultChecked
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full sm:w-auto">
                    Save Preferences
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account details and profile picture.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAccountSubmit}>
                <div className="space-y-6">
                  {/* Profile Picture Section */}
                  <div className="flex flex-col items-center md:flex-row md:items-start gap-6 pb-6 border-b">
                    <div className="relative">
                      <Avatar className="w-32 h-32 cursor-pointer" onClick={handleProfilePictureClick}>
                        {profilePicture ? (
                          <AvatarImage 
                            src={profilePicture} 
                            alt="Profile"
                          />
                        ) : (
                          <AvatarFallback className="text-3xl bg-primary/10">
                            {accountInfo.firstName?.charAt(0) || accountInfo.username.charAt(0)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div 
                        className="absolute bottom-0 right-0 p-1 bg-primary text-white rounded-full cursor-pointer"
                        onClick={handleProfilePictureClick}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 16v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1"></path>
                          <polygon points="12 2 15 5 8 12 5 12 5 9"></polygon>
                          <line x1="12" y1="5" x2="19" y2="12"></line>
                        </svg>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="profilePicture"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                    </div>
                    <div className="flex-1 space-y-2 text-center md:text-left">
                      <h3 className="text-lg font-medium">Profile Picture</h3>
                      <p className="text-sm text-gray-500">
                        Click on the avatar to upload a new profile picture. 
                        Recommended size is at least 300x300 pixels.
                      </p>
                      {profilePictureMutation.isPending && (
                        <div className="flex items-center space-x-2 text-sm text-blue-600">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Uploading image...</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Account Details */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        name="username"
                        value={accountInfo.username}
                        onChange={handleAccountChange}
                        className="mt-1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={accountInfo.firstName || ''}
                        onChange={handleAccountChange}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={accountInfo.lastName || ''}
                        onChange={handleAccountChange}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        value={accountInfo.email || ''}
                        onChange={handleAccountChange}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  {/* Password Section */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">Change Password</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <Button 
                      type="submit"
                      disabled={profileMutation.isPending}
                    >
                      {profileMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Saving...
                        </span>
                      ) : "Save Account Details"}
                    </Button>
                    <Button variant="outline" type="button" onClick={() => {
                      // Reset form to the original values from the profileQuery
                      if (profileQuery.data) {
                        setAccountInfo({
                          username: profileQuery.data.username,
                          firstName: profileQuery.data.firstName || '',
                          lastName: profileQuery.data.lastName || '',
                          email: profileQuery.data.email || '',
                        });
                      }
                      
                      toast({
                        title: "Changes Discarded",
                        description: "Your changes have been discarded."
                      });
                    }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
