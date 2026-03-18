class AppError implements Exception {
  final String message;
  final String? code;

  const AppError(this.message, {this.code});

  @override
  String toString() => 'AppError($code): $message';
}

class AuthError extends AppError {
  const AuthError(super.message, {super.code});
}

class DatabaseError extends AppError {
  const DatabaseError(super.message, {super.code});
}

class NetworkError extends AppError {
  const NetworkError(super.message, {super.code});
}

class PermissionError extends AppError {
  const PermissionError(super.message) : super(code: 'PERMISSION_DENIED');
}
