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

  // Fetch all campaigns
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['/api/sales/campaigns'],
    refetchOnWindowFocus: true
  });

  // Create new campaign
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      return apiRequest('/api/sales/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignData),
      });
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
      return apiRequest(`/api/sales/campaigns/${campaignId}`, {
        method: 'DELETE',
      });
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
      return apiRequest(`/api/sales/campaigns/${campaignId}/targets`, {
        method: 'POST',
        body: JSON.stringify(targetData),
      });
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
      return apiRequest(`/api/sales/campaigns/${campaignId}/targets/${targetId}`, {
        method: 'DELETE',
      });
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
      return apiRequest(`/api/sales/campaigns/${campaignId}/apply`, {
        method: 'POST',
      });
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
      return apiRequest(`/api/sales/campaigns/${campaignId}/revert`, {
        method: 'POST',
      });
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
      startDate: newCampaign.startDate,
      endDate: newCampaign.endDate,
      discountType: newCampaign.discountType,
      discountValue: Number(newCampaign.discountValue),
    };
    createCampaignMutation.mutate(campaignData);
  };

  const handleAddTarget = () => {
    if (!selectedCampaign) return;
    
    const targetData = {
      targetType: newTarget.targetType,
      targetId: newTarget.targetType === 'product' ? Number(newTarget.targetId) : null,
      targetValue: newTarget.targetType === 'vendor' || newTarget.targetType === 'product_type' 
        ? newTarget.targetValue 
        : null,
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
        <Button onClick={() => setIsCreateDialogOpen(true)}>
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

      {/* Create Campaign Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Sale Campaign</DialogTitle>
            <DialogDescription>
              Set up a new sale campaign to apply discounts to your products.
            </DialogDescription>
          </DialogHeader>
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
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign} disabled={!newCampaign.name}>
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
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
        <DialogContent className="sm:max-w-[500px]">
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
            
            {newTarget.targetType === 'vendor' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vendorName" className="text-right">
                  Vendor Name
                </Label>
                <Input
                  id="vendorName"
                  className="col-span-3"
                  value={newTarget.targetValue}
                  onChange={(e) => setNewTarget({ ...newTarget, targetValue: e.target.value })}
                  placeholder="e.g. Nike, Adidas"
                />
              </div>
            )}
            
            {newTarget.targetType === 'product_type' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="productType" className="text-right">
                  Product Type
                </Label>
                <Input
                  id="productType"
                  className="col-span-3"
                  value={newTarget.targetValue}
                  onChange={(e) => setNewTarget({ ...newTarget, targetValue: e.target.value })}
                  placeholder="e.g. Shoes, Shirts"
                />
              </div>
            )}
            
            {newTarget.targetType === 'product' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="productId" className="text-right">
                  Product ID
                </Label>
                <Input
                  id="productId"
                  type="number"
                  className="col-span-3"
                  value={newTarget.targetId || ''}
                  onChange={(e) => setNewTarget({ ...newTarget, targetId: parseInt(e.target.value) || null })}
                  placeholder="Enter product ID"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTargetDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddTarget}
              disabled={
                (newTarget.targetType === 'vendor' || newTarget.targetType === 'product_type') 
                  ? !newTarget.targetValue 
                  : !newTarget.targetId
              }
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