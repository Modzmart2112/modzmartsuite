import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Trash2, PlusCircleIcon, TagIcon, PercentIcon, DollarSignIcon, RefreshCwIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SaleCampaign, SaleCampaignTarget } from '@shared/schema';
import { ProductList } from '@/components/products/product-list';

const SaleManagementPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<SaleCampaign | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isAddTargetDialogOpen, setIsAddTargetDialogOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    status: 'draft',
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    discountType: 'percentage',
    discountValue: 10,
    isActive: false,
  });
  const [newTarget, setNewTarget] = useState({
    targetType: 'vendor',
    targetId: null,
    targetValue: '',
  });

  // Multi-step creation states
  const [createStep, setCreateStep] = useState<'select-products' | 'campaign-details' | 'select-vendors'>('select-products');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [excludeBelowCost, setExcludeBelowCost] = useState(true);
  
  // Fetch all vendors for the vendor selection step
  const { data: vendorsData } = useQuery({
    queryKey: ['/api/products/vendors'],
    refetchOnWindowFocus: true
  });
  
  // Fetch all product types for the product selection step
  const { data: productTypesData } = useQuery({
    queryKey: ['/api/products/product-types'],
    refetchOnWindowFocus: true
  });

  // Fetch all campaigns
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['/api/sales/campaigns'],
    refetchOnWindowFocus: true
  });

  // Create new campaign
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      return apiRequest('POST', '/api/sales/campaigns', campaignData);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Sale campaign created successfully',
      });
      setIsCreateDialogOpen(false);
      resetNewCampaignForm();
      queryClient.invalidateQueries({ queryKey: ['/api/sales/campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to create campaign: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete campaign
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return apiRequest('DELETE', `/api/sales/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Sale campaign deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to delete campaign: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Add target
  const addTargetMutation = useMutation({
    mutationFn: async ({ campaignId, targetData }: any) => {
      return apiRequest('POST', `/api/sales/campaigns/${campaignId}/targets`, targetData);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Target added successfully',
      });
      setIsAddTargetDialogOpen(false);
      resetNewTargetForm();
      if (selectedCampaign) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/campaigns/${selectedCampaign.id}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to add target: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Remove target
  const removeTargetMutation = useMutation({
    mutationFn: async ({ campaignId, targetId }: any) => {
      return apiRequest('DELETE', `/api/sales/campaigns/${campaignId}/targets/${targetId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Target removed successfully',
      });
      if (selectedCampaign) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/campaigns/${selectedCampaign.id}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to remove target: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Apply campaign
  const applyCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return apiRequest('POST', `/api/sales/campaigns/${campaignId}/apply`);
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Sale applied to ${data.affectedProductsCount} products`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/campaigns'] });
      if (selectedCampaign) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/campaigns/${selectedCampaign.id}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to apply campaign: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Revert campaign
  const revertCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return apiRequest('POST', `/api/sales/campaigns/${campaignId}/revert`);
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Sale reverted for ${data.revertedProductsCount} products`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/campaigns'] });
      if (selectedCampaign) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/campaigns/${selectedCampaign.id}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to revert campaign: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Fetch campaign details
  const { data: campaignDetailsData, isLoading: isLoadingDetails } = useQuery({
    queryKey: [`/api/sales/campaigns/${selectedCampaign?.id}`],
    enabled: !!selectedCampaign,
    refetchOnWindowFocus: true
  });

  // Form handlers
  const handleCreateCampaign = () => {
    const campaignData = {
      name: newCampaign.name,
      description: newCampaign.description || null,
      status: newCampaign.isActive ? 'active' : 'draft',
      startDate: newCampaign.startDate.toISOString(), // Format dates as ISO strings
      endDate: newCampaign.endDate.toISOString(),     // Format dates as ISO strings
      discountType: newCampaign.discountType,
      discountValue: Number(newCampaign.discountValue),
    };
    
    // Use the mutation directly instead of apiRequest
    createCampaignMutation.mutate(campaignData);
  };

  const handleAddTarget = () => {
    if (!selectedCampaign) return;
    
    // Ensure we have valid data before proceeding
    if (newTarget.targetType === 'product' && !newTarget.targetValue) {
      toast({
        title: "Invalid Shopify Product ID",
        description: "Please enter a valid Shopify product ID",
        variant: "destructive"
      });
      return;
    }
    
    if ((newTarget.targetType === 'vendor' || newTarget.targetType === 'product_type') && !newTarget.targetValue) {
      toast({
        title: "Missing Value",
        description: `Please select a ${newTarget.targetType === 'vendor' ? 'vendor' : 'product type'}`,
        variant: "destructive"
      });
      return;
    }
    
    const targetData = {
      targetType: newTarget.targetType,
      targetId: null, // Not used anymore - using targetValue for Shopify ID
      targetValue: newTarget.targetValue, // Store the value for all target types
    };
    
    addTargetMutation.mutate({ 
      campaignId: selectedCampaign.id, 
      targetData 
    });
  };

  const handleRemoveTarget = (targetId: number) => {
    if (!selectedCampaign) return;
    
    removeTargetMutation.mutate({ 
      campaignId: selectedCampaign.id, 
      targetId 
    });
  };

  const handleViewDetails = (campaign: SaleCampaign) => {
    setSelectedCampaign(campaign);
    setIsDetailsDialogOpen(true);
  };

  const handleApplyCampaign = () => {
    if (!selectedCampaign) return;
    applyCampaignMutation.mutate(selectedCampaign.id);
  };

  const handleRevertCampaign = () => {
    if (!selectedCampaign) return;
    revertCampaignMutation.mutate(selectedCampaign.id);
  };

  const resetNewCampaignForm = () => {
    setNewCampaign({
      name: '',
      description: '',
      status: 'draft',
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      discountType: 'percentage',
      discountValue: 10,
      isActive: false,
    });
  };

  const resetNewTargetForm = () => {
    setNewTarget({
      targetType: 'vendor',
      targetId: null,
      targetValue: '',
    });
  };
  
  const handleProductSelection = (productIds: number[]) => {
    setSelectedProductIds(productIds);
  };
  
  const startNewCampaign = () => {
    setCreateStep('select-products');
    setSelectedProductIds([]);
    setSelectedVendor(null);
    setSelectedProductType(null);
    setIsCreateDialogOpen(true);
  };
  
  const proceedToCampaignDetails = () => {
    // Reset the new campaign form with default values
    resetNewCampaignForm();
    setCreateStep('campaign-details');
  };
  
  const resetSelectionState = () => {
    setCreateStep('select-products');
    setSelectedProductIds([]);
    setSelectedVendor(null);
    setSelectedProductType(null);
  };
  
  const handleCreateWithSelection = () => {
    // First create the campaign without targets
    const campaignData = {
      name: newCampaign.name,
      description: newCampaign.description || null,
      status: newCampaign.isActive ? 'active' : 'draft',
      startDate: newCampaign.startDate.toISOString(), // Format dates as ISO strings
      endDate: newCampaign.endDate.toISOString(),     // Format dates as ISO strings
      discountType: newCampaign.discountType,
      discountValue: Number(newCampaign.discountValue)
      // excludeBelowCost is handled server-side or with targets
    };
    
    // Create the campaign using mutation
    createCampaignMutation.mutate(campaignData, {
      onSuccess: async (response) => {
        const newCampaignId = response.campaign.id;
        
        try {
          // Define targets based on selection
          let targetPromises: Promise<any>[] = [];
          
          if (selectedProductIds.length > 0) {
            // Get the products data to extract Shopify IDs
            // Using URL parameters for GET request instead of body
            const queryParams = new URLSearchParams({ ids: selectedProductIds.join(',') }).toString();
            const productsResponse = await apiRequest('GET', `/api/products?${queryParams}`);
            
            if (productsResponse.products) {
              // Add product targets using Shopify IDs
              targetPromises = productsResponse.products.map((product: any) => {
                const targetData = {
                  targetType: 'product',
                  targetId: null,
                  targetValue: product.shopifyId.toString() // Use Shopify ID as targetValue
                };
                return apiRequest('POST', `/api/sales/campaigns/${newCampaignId}/targets`, targetData);
              });
            }
          } else if (selectedVendor) {
            // Add vendor target
            const targetData = {
              targetType: 'vendor',
              targetId: null,
              targetValue: selectedVendor
            };
            targetPromises = [apiRequest('POST', `/api/sales/campaigns/${newCampaignId}/targets`, targetData)];
          } else if (selectedProductType) {
            // Add product_type target
            const targetData = {
              targetType: 'product_type',
              targetId: null,
              targetValue: selectedProductType
            };
            targetPromises = [apiRequest('POST', `/api/sales/campaigns/${newCampaignId}/targets`, targetData)];
          }
          
          // Wait for all target additions to complete
          await Promise.all(targetPromises);
          
          toast({
            title: 'Success',
            description: 'Sale campaign created successfully with targets',
          });
          
          queryClient.invalidateQueries({ queryKey: ['/api/sales/campaigns'] });
          setIsCreateDialogOpen(false);
          resetSelectionState();
        } catch (error: any) {
          toast({
            title: 'Error',
            description: `Failed to add targets: ${error.message}`,
            variant: 'destructive',
          });
        }
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: `Failed to create campaign: ${error.message}`,
          variant: 'destructive',
        });
      }
    });
  };

  // UI helpers
  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, any> = {
      active: { variant: 'default', label: 'Active' },
      draft: { variant: 'secondary', label: 'Draft' },
      completed: { variant: 'outline', label: 'Completed' },
      scheduled: { variant: 'secondary', label: 'Scheduled' },
    };
    
    const statusConfig = statusColors[status] || statusColors.draft;
    
    return (
      <Badge variant={statusConfig.variant as any}>
        {statusConfig.label}
      </Badge>
    );
  };

  const getDiscountTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <PercentIcon className="h-4 w-4" />;
      case 'fixed_amount':
        return <DollarSignIcon className="h-4 w-4" />;
      case 'new_price':
        return <TagIcon className="h-4 w-4" />;
      default:
        return <PercentIcon className="h-4 w-4" />;
    }
  };

  const formatDiscountValue = (type: string, value: number) => {
    switch (type) {
      case 'percentage':
        return `${value}%`;
      case 'fixed_amount':
        return `$${value.toFixed(2)}`;
      case 'new_price':
        return `$${value.toFixed(2)}`;
      default:
        return `${value}`;
    }
  };

  const getTargetTypeLabel = (type: string, value: string | null) => {
    switch (type) {
      case 'vendor':
        return `Vendor: ${value}`;
      case 'product_type':
        return `Product Type: ${value}`;
      case 'product':
        return `Product ID: ${value}`;
      default:
        return type;
    }
  };

  const getDateRangeString = (start: Date, end: Date) => {
    return `${format(new Date(start), 'MMM d, yyyy')} - ${format(new Date(end), 'MMM d, yyyy')}`;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Sale Management</h1>
          <p className="text-muted-foreground">Create and manage time-limited discounts</p>
        </div>
        <Button onClick={startNewCampaign}>
          <PlusCircleIcon className="h-4 w-4 mr-2" />
          Create New Sale
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Sale Campaigns</CardTitle>
          <CardDescription>
            These campaigns apply discounts to products based on different criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : campaignsData?.campaigns?.length ? (
                campaignsData.campaigns.map((campaign: SaleCampaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status || 'draft')}</TableCell>
                    <TableCell>{getDateRangeString(new Date(campaign.startDate), new Date(campaign.endDate))}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {getDiscountTypeIcon(campaign.discountType)}
                        <span className="ml-2">
                          {formatDiscountValue(campaign.discountType, campaign.discountValue)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewDetails(campaign)}
                        >
                          Details
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this campaign?')) {
                              deleteCampaignMutation.mutate(campaign.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No sale campaigns found. Create your first one!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Multi-Step Create Campaign Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) {
          resetSelectionState();
        }
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className={createStep === 'select-products' ? "sm:max-w-full w-[90vw] max-h-[80vh] overflow-y-auto" : "sm:max-w-full w-[90vw]"}>
          <DialogHeader>
            <DialogTitle>
              {createStep === 'select-products' && 'Select Products or Vendor for Sale'}
              {createStep === 'select-vendors' && 'Select Vendor for Sale'}
              {createStep === 'campaign-details' && 'Create Sale Campaign'}
            </DialogTitle>
            <DialogDescription>
              {createStep === 'select-products' && 'Choose individual products or a vendor to apply your discount to.'}
              {createStep === 'select-vendors' && 'Choose a vendor to apply your discount to all their products.'}
              {createStep === 'campaign-details' && 'Set up discount details for your selected items.'}
            </DialogDescription>
          </DialogHeader>
          
          {createStep === 'select-products' && (
            <>
              <Tabs defaultValue="products" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="products">Select Products</TabsTrigger>
                  <TabsTrigger value="vendor">Select Vendor</TabsTrigger>
                  <TabsTrigger value="product-type">Select Product Type</TabsTrigger>
                </TabsList>
                
                <TabsContent value="products" className="mt-4">
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Select individual products to include in this sale. 
                      You can use the filters to narrow down your selection.
                    </p>
                    {selectedProductIds.length > 0 && (
                      <div className="bg-primary/10 p-2 rounded mt-2 text-sm">
                        <span className="font-semibold">{selectedProductIds.length} products selected</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="max-h-[500px] overflow-y-auto border rounded-md">
                    {/* Import and use the ProductList component in selectable mode */}
                    <div className="p-4">
                      <div className="flex items-center justify-end mb-4">
                        <Button onClick={proceedToCampaignDetails} disabled={selectedProductIds.length === 0}>
                          Continue with {selectedProductIds.length} selected products
                        </Button>
                      </div>
                      
                      {/* Use the ProductList component with selectable mode */}
                      <ProductList 
                        selectable={true} 
                        onProductSelect={handleProductSelection} 
                        selectedProductIds={selectedProductIds}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="vendor" className="mt-4">
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Select a vendor to apply the discount to all products from that vendor.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {vendorsData?.vendors ? (
                        vendorsData.vendors.map((vendor: string) => (
                          <Card 
                            key={vendor}
                            className={cn(
                              "cursor-pointer transition-all hover:border-primary",
                              selectedVendor === vendor ? "border-primary bg-primary/5" : ""
                            )}
                            onClick={() => setSelectedVendor(vendor)}
                          >
                            <CardContent className="p-4 flex items-center justify-between">
                              <div>
                                <h3 className="font-medium">{vendor}</h3>
                              </div>
                              {selectedVendor === vendor && (
                                <div className="text-primary">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-5 w-5"
                                  >
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="col-span-2 text-center py-4">
                          Loading vendors...
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button onClick={proceedToCampaignDetails} disabled={!selectedVendor}>
                      Continue with vendor: {selectedVendor || ''}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="product-type" className="mt-4">
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Select a product type/category to apply the discount to all products of that type.
                    </p>
                    
                    <div className="max-h-[400px] overflow-y-auto border rounded-md p-4">
                      {productTypesData?.productTypes ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {productTypesData.productTypes.map((type: string) => (
                            <Card 
                              key={type}
                              className={cn(
                                "cursor-pointer transition-all hover:border-primary",
                                selectedProductType === type ? "border-primary bg-primary/5" : ""
                              )}
                              onClick={() => setSelectedProductType(type)}
                            >
                              <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                  <h3 className="font-medium">{type}</h3>
                                </div>
                                {selectedProductType === type && (
                                  <div className="text-primary">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="h-5 w-5"
                                    >
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          Loading product types...
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button onClick={proceedToCampaignDetails} disabled={!selectedProductType}>
                      Continue with product type: {selectedProductType || ''}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}
          
          {createStep === 'campaign-details' && (
            <>
              <div className="bg-muted/30 p-3 rounded mb-4">
                <h3 className="font-medium mb-1">Selected items:</h3>
                {selectedProductIds.length > 0 && (
                  <p className="text-sm">{selectedProductIds.length} product(s) selected</p>
                )}
                {selectedVendor && (
                  <p className="text-sm">Vendor: {selectedVendor}</p>
                )}
                {selectedProductType && (
                  <p className="text-sm">Product Type: {selectedProductType}</p>
                )}
              </div>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    className="col-span-3"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    placeholder="Summer Sale 2025"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    className="col-span-3"
                    value={newCampaign.description}
                    onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                    placeholder="Special discounts for the summer season"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="startDate" className="text-right">
                    Start Date
                  </Label>
                  <div className="col-span-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newCampaign.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newCampaign.startDate ? format(newCampaign.startDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newCampaign.startDate}
                          onSelect={(date) => date && setNewCampaign({ ...newCampaign, startDate: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="endDate" className="text-right">
                    End Date
                  </Label>
                  <div className="col-span-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newCampaign.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newCampaign.endDate ? format(newCampaign.endDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newCampaign.endDate}
                          onSelect={(date) => date && setNewCampaign({ ...newCampaign, endDate: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="discountType" className="text-right">
                    Discount Type
                  </Label>
                  <Select
                    value={newCampaign.discountType}
                    onValueChange={(value) => setNewCampaign({ ...newCampaign, discountType: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select discount type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                      <SelectItem value="new_price">New Price ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="discountValue" className="text-right">
                    {newCampaign.discountType === 'percentage' ? 'Percentage' : 
                     newCampaign.discountType === 'fixed_amount' ? 'Amount' : 'New Price'}
                  </Label>
                  <div className="col-span-3 flex items-center">
                    {newCampaign.discountType !== 'percentage' && <span className="mr-2">$</span>}
                    <Input
                      id="discountValue"
                      type="number"
                      value={newCampaign.discountValue}
                      onChange={(e) => setNewCampaign({ ...newCampaign, discountValue: parseFloat(e.target.value) })}
                      placeholder={newCampaign.discountType === 'percentage' ? "10" : "5.99"}
                    />
                    {newCampaign.discountType === 'percentage' && <span className="ml-2">%</span>}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="excludeBelowCost" className="text-right">
                    Exclude Below Cost
                  </Label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Switch
                      id="excludeBelowCost"
                      checked={excludeBelowCost}
                      onCheckedChange={setExcludeBelowCost}
                    />
                    <Label htmlFor="excludeBelowCost">
                      {excludeBelowCost ? 'Enabled - Skip products where discount would make price below cost' : 'Disabled - Apply discount to all products'}
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="isActive" className="text-right">
                    Active Status
                  </Label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Switch
                      id="isActive"
                      checked={newCampaign.isActive}
                      onCheckedChange={(checked) => setNewCampaign({ ...newCampaign, isActive: checked })}
                    />
                    <Label htmlFor="isActive">
                      {newCampaign.isActive ? 'Active (apply immediately)' : 'Draft (apply manually later)'}
                    </Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateStep('select-products')}>
                  Back
                </Button>
                <Button onClick={handleCreateWithSelection} disabled={!newCampaign.name}>
                  Create Campaign
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-full w-[90vw]">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
            <DialogDescription>
              View and manage details for this sale campaign
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex justify-center items-center py-12">
              Loading campaign details...
            </div>
          ) : campaignDetailsData?.campaign ? (
            <div className="py-4">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="targets">Targets</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Name</h4>
                      <p className="text-base">{campaignDetailsData.campaign.name}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                      <div>{getStatusBadge(campaignDetailsData.campaign.status || 'draft')}</div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Start Date</h4>
                      <p className="text-base">{format(new Date(campaignDetailsData.campaign.startDate), "PPP")}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">End Date</h4>
                      <p className="text-base">{format(new Date(campaignDetailsData.campaign.endDate), "PPP")}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Discount Type</h4>
                      <div className="flex items-center">
                        {getDiscountTypeIcon(campaignDetailsData.campaign.discountType)}
                        <span className="ml-2">
                          {campaignDetailsData.campaign.discountType === 'percentage' ? 'Percentage' : 
                           campaignDetailsData.campaign.discountType === 'fixed_amount' ? 'Fixed Amount' : 'New Price'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Discount Value</h4>
                      <p className="text-base font-medium">
                        {formatDiscountValue(
                          campaignDetailsData.campaign.discountType,
                          campaignDetailsData.campaign.discountValue
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {campaignDetailsData.campaign.description && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                      <p className="text-base mt-1">{campaignDetailsData.campaign.description}</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="targets" className="space-y-4 mt-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Campaign Targets</h3>
                    <Button size="sm" onClick={() => setIsAddTargetDialogOpen(true)}>
                      <PlusCircleIcon className="h-4 w-4 mr-2" />
                      Add Target
                    </Button>
                  </div>
                  
                  {campaignDetailsData.targets?.length ? (
                    <div className="space-y-3">
                      {campaignDetailsData.targets.map((target: SaleCampaignTarget) => (
                        <div 
                          key={target.id} 
                          className="flex justify-between items-center p-3 border rounded-md"
                        >
                          <div>
                            <Badge variant="outline" className="mb-1">
                              {target.targetType}
                            </Badge>
                            <div className="font-medium">
                              {getTargetTypeLabel(target.targetType, target.targetValue)}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemoveTarget(target.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No targets defined. Add targets to apply this sale to specific products.
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="actions" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="border rounded-md p-4">
                      <h3 className="text-lg font-medium mb-2">Apply Campaign</h3>
                      <p className="text-muted-foreground mb-4">
                        Apply this discount to all matching products based on the defined targets.
                      </p>
                      <Button 
                        className="w-full" 
                        onClick={handleApplyCampaign}
                      >
                        <TagIcon className="h-4 w-4 mr-2" />
                        Apply Sale Prices
                      </Button>
                    </div>
                    
                    <div className="border rounded-md p-4">
                      <h3 className="text-lg font-medium mb-2">Revert Campaign</h3>
                      <p className="text-muted-foreground mb-4">
                        Restore original prices and remove this discount from all products.
                      </p>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={handleRevertCampaign}
                      >
                        <RefreshCwIcon className="h-4 w-4 mr-2" />
                        Revert to Original Prices
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Campaign details not found.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Target Dialog */}
      <Dialog open={isAddTargetDialogOpen} onOpenChange={setIsAddTargetDialogOpen}>
        <DialogContent className="sm:max-w-full w-[90vw]">
          <DialogHeader>
            <DialogTitle>Add Campaign Target</DialogTitle>
            <DialogDescription>
              Define which products this campaign will apply to.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="targetType" className="text-right">
                Target Type
              </Label>
              <Select
                value={newTarget.targetType}
                onValueChange={(value) => setNewTarget({ 
                  ...newTarget, 
                  targetType: value,
                  targetId: null,
                  targetValue: ''
                })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select target type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor">Vendor/Brand</SelectItem>
                  <SelectItem value="product_type">Product Type/Category</SelectItem>
                  <SelectItem value="product">Specific Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Target Value Field - show different inputs based on target type */}
            {newTarget.targetType === 'vendor' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetValue" className="text-right">
                  Vendor Name
                </Label>
                <Select
                  value={newTarget.targetValue}
                  onValueChange={(value) => setNewTarget({ ...newTarget, targetValue: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorsData?.vendors ? 
                      vendorsData.vendors.map((vendor: string) => (
                        <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                      )) : 
                      <SelectItem value="loading" disabled>Loading vendors...</SelectItem>
                    }
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {newTarget.targetType === 'product_type' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetValue" className="text-right">
                  Product Type
                </Label>
                <Select
                  value={newTarget.targetValue}
                  onValueChange={(value) => setNewTarget({ ...newTarget, targetValue: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {productTypesData?.productTypes ? 
                      productTypesData.productTypes.map((type: string) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      )) : 
                      <SelectItem value="loading" disabled>Loading product types...</SelectItem>
                    }
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {newTarget.targetType === 'product' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetId" className="text-right">
                  Shopify Product ID
                </Label>
                <div className="col-span-3 space-y-1">
                  <Input
                    id="targetId"
                    type="text"
                    value={newTarget.targetValue}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      setNewTarget({ 
                        ...newTarget, 
                        targetValue: value
                      });
                    }}
                    placeholder="Enter Shopify product ID (numeric)"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can copy this from the Shopify ID column in the Products table
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTargetDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddTarget} 
              disabled={!newTarget.targetValue}
            >
              Add Target
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaleManagementPage;