import { ProductList } from "@/components/products/product-list";

export default function Products() {
  return (
    <div className="container mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 md:mb-0">Product Catalog</h1>
      </div>
      
      <ProductList />
    </div>
  );
}
