import { db } from './server/db';
import { storage } from './server/storage';

/**
 * This script tests the sale campaign application and reversion, focusing on 
 * the compare-at price functionality when reverting prices
 */
async function testSaleCampaignRevert() {
  try {
    console.log('Testing sale campaign application and reversion with compare-at price functionality...');
    
    // Create a test sale campaign
    const campaign = await storage.createSaleCampaign({
      name: 'Test Compare-At Price Campaign',
      description: 'Testing the compare-at price functionality when reverting sales',
      status: 'draft',
      discountType: 'percentage',
      discountValue: 15, // 15% discount
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });
    
    console.log(`Created test campaign with ID ${campaign.id}`);
    
    // Add a target for a specific product that we know exists
    await storage.addSaleCampaignTarget({
      campaignId: campaign.id,
      targetType: 'product',
      targetId: 1598, // SIL-RP-016 product ID
      targetValue: null
    });
    
    console.log('Added target product (SIL-RP-016) to campaign');
    
    // Apply the campaign
    const affectedCount = await storage.applySaleCampaign(campaign.id);
    console.log(`Applied campaign to ${affectedCount} products`);
    
    // Wait a moment
    console.log('Waiting 3 seconds before reverting...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Now revert the campaign
    const revertedCount = await storage.revertSaleCampaign(campaign.id);
    console.log(`Reverted campaign, affected ${revertedCount} products`);
    
    // Delete the test campaign
    await storage.deleteSaleCampaign(campaign.id);
    console.log(`Deleted test campaign ${campaign.id}`);
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error testing sale campaign:', error);
  } finally {
    process.exit(0);
  }
}

testSaleCampaignRevert();