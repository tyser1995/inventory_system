import 'dart:async';
import 'package:flutter/material.dart';

/// Search field with 300ms debounce.
class DebouncedSearchField extends StatefulWidget {
  final ValueChanged<String?> onChanged;
  final String? hint;
  final String? initialValue;

  const DebouncedSearchField({
    super.key,
    required this.onChanged,
    this.hint,
    this.initialValue,
  });

  @override
  State<DebouncedSearchField> createState() => _DebouncedSearchFieldState();
}

class _DebouncedSearchFieldState extends State<DebouncedSearchField> {
  Timer? _debounce;
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      widget.onChanged(value.isEmpty ? null : value);
    });
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      decoration: InputDecoration(
        hintText: widget.hint ?? 'Search...',
        prefixIcon: const Icon(Icons.search),
        suffixIcon: _controller.text.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () {
                  _controller.clear();
                  widget.onChanged(null);
                },
              )
            : null,
      ),
      onChanged: _onChanged,
    );
  }
}
