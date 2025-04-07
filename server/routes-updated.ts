// This is a temporary file to hold the updated version of the routes.ts file
// Copy the relevant section with our fix here for comparison

// Delete a CSV upload - UPDATED VERSION
app.delete("/api/csv/uploads/:id", asyncHandler(async (req, res) => {
  const uploadId = parseInt(req.params.id);
  
  if (isNaN(uploadId)) {
    return res.status(400).json({ message: "Invalid upload ID" });
  }
  
  // Get the CSV upload to delete
  const csvUploads = await storage.getRecentCsvUploads(100);
  const uploadToDelete = csvUploads.find(upload => upload.id === uploadId);
  
  if (!uploadToDelete) {
    return res.status(404).json({ message: "Upload not found" });
  }
  
  console.log(`Processing deletion of CSV upload: ${uploadToDelete.filename}`);
  
  try {
    // First, check if the CSV file exists (it might have been deleted already)
    const csvPath = path.join(process.cwd(), 'attached_assets', uploadToDelete.filename);
    let records: CsvRecord[] = [];
    let fileExists = false;
    
    try {
      // Check if file exists before trying to read it
      await fs.promises.access(csvPath, fs.constants.F_OK);
      fileExists = true;
      console.log(`Found CSV file at path: ${csvPath}`);
      
      // Try to extract records from the CSV to know which products to clear
      records = await processCsvFile(csvPath);
      console.log(`Found ${records.length} records in CSV file ${uploadToDelete.filename}`);
    } catch (error) {
      console.error(`File access or processing error for ${uploadToDelete.filename}:`, error);
      console.warn(`File may be missing or invalid - proceeding with deletion anyway`);
      // We'll continue with the deletion even if the file can't be found or processed
    }
    
    // Use the stored product IDs from the CSV upload record to determine which products to update
    const productIdsToUpdate = uploadToDelete.updatedProductIds || [];
    console.log(`Found ${productIdsToUpdate.length} product IDs associated with this CSV upload`);
    
    // Get all products
    const allProducts = await storage.getProducts(1000, 0);
    
    // Filter to only the products that were updated by this specific CSV
    // We want to reset them regardless of whether they currently have supplier data
    const productsToUpdate = allProducts.filter(p => 
      productIdsToUpdate.includes(p.id));
      
    console.log(`Found ${productsToUpdate.length} products from this CSV that will be reset`);
    
    console.log(`Found ${productsToUpdate.length} products to update from CSV ${uploadToDelete.filename}`);
    
    // NEW BEHAVIOR: We no longer clear supplier URLs or prices when deleting a CSV
    // This preserves the data for products but removes their association with the CSV upload
    console.log(`CSV deletion will preserve supplier URLs and prices for ${productsToUpdate.length} products`);
    
    // Skip the loop that would clear supplier data - just count the products
    let successCount = productsToUpdate.length;
    let failCount = 0;
    
    // Now delete the CSV upload
    const result = await storage.deleteCsvUpload(uploadId);
    
    if (!result) {
      return res.status(404).json({ message: "CSV upload deletion failed" });
    }
    
    res.json({ 
      success: true, 
      message: `Upload deleted successfully. Preserved data for ${successCount} products, ${failCount} failures.`
    });
  } catch (error) {
    console.error(`Error during CSV deletion process:`, error);
    res.status(500).json({ message: "An error occurred during CSV deletion" });
  }
}));