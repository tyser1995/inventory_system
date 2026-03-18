import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/transaction.dart';
import '../../domain/repositories/transaction_repository.dart';
import 'core_providers.dart';

class TransactionListState {
  final List<InventoryTransaction> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final TransactionType? typeFilter;
  final bool sortAscending;
  final bool isLoading;
  final String? error;

  const TransactionListState({
    this.items = const [],
    this.totalCount = 0,
    this.page = 0,
    this.pageSize = 10,
    this.typeFilter,
    this.sortAscending = false,
    this.isLoading = false,
    this.error,
  });

  int get totalPages => (totalCount / pageSize).ceil();

  TransactionListState copyWith({
    List<InventoryTransaction>? items,
    int? totalCount,
    int? page,
    int? pageSize,
    TransactionType? typeFilter,
    bool? sortAscending,
    bool? isLoading,
    String? error,
  }) {
    return TransactionListState(
      items: items ?? this.items,
      totalCount: totalCount ?? this.totalCount,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      typeFilter: typeFilter ?? this.typeFilter,
      sortAscending: sortAscending ?? this.sortAscending,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class TransactionListNotifier extends Notifier<TransactionListState> {
  @override
  TransactionListState build() {
    Future.microtask(_load);
    return const TransactionListState(isLoading: true);
  }

  TransactionRepository get _repo => ref.read(transactionRepositoryProvider);

  Future<void> _load() async {
    try {
      final result = await _repo.getTransactions(
        page: state.page,
        pageSize: state.pageSize,
        type: state.typeFilter,
        sortAscending: state.sortAscending,
      );
      state = state.copyWith(
        items: result.items,
        totalCount: result.totalCount,
        isLoading: false,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setPage(int page) {
    state = state.copyWith(page: page, isLoading: true);
    _load();
  }

  void setPageSize(int size) {
    state = state.copyWith(pageSize: size, page: 0, isLoading: true);
    _load();
  }

  void setTypeFilter(TransactionType? type) {
    state = state.copyWith(typeFilter: type, page: 0, isLoading: true);
    _load();
  }

  Future<void> refresh() {
    state = state.copyWith(isLoading: true);
    return _load();
  }

  Future<void> createTransaction(InventoryTransaction tx) async {
    await _repo.createTransaction(tx);
    await _load();
  }
}

final transactionListProvider =
    NotifierProvider<TransactionListNotifier, TransactionListState>(
        TransactionListNotifier.new);
