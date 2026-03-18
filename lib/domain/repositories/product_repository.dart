import '../entities/product.dart';
import '../entities/category.dart';

class PagedResult<T> {
  final List<T> items;
  final int totalCount;

  const PagedResult({required this.items, required this.totalCount});
}

abstract class ProductRepository {
  Future<PagedResult<Product>> getProducts({
    int page = 0,
    int pageSize = 10,
    String? search,
    String? categoryId,
    String? sortColumn,
    bool sortAscending = true,
  });
  Future<Product?> getProductById(String id);
  Future<Product> createProduct(Product product);
  Future<Product> updateProduct(Product product);
  Future<void> deleteProduct(String id);
  Future<List<Product>> getLowStockProducts();
  Future<int> getTotalProductCount();
  Future<int> getTotalStockValue(); // sum of price*quantity
}

abstract class CategoryRepository {
  Future<List<Category>> getCategories({String? search});
  Future<Category?> getCategoryById(String id);
  Future<Category> createCategory(Category category);
  Future<Category> updateCategory(Category category);
  Future<void> deleteCategory(String id);
}
