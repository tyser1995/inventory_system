import 'dart:convert';
import 'package:bcrypt/bcrypt.dart';
import 'package:crypto/crypto.dart';

/// Returns a bcrypt hash of [password] with a newly generated salt.
String hashPassword(String password) =>
    BCrypt.hashpw(password, BCrypt.gensalt());

/// Returns true when [password] matches [storedHash].
///
/// Transparently handles both formats:
/// - bcrypt hashes (start with `$2`) — verified with [BCrypt.checkpw]
/// - Legacy unsalted SHA-256 hashes (64-char hex) — verified by re-hashing
///
/// After a successful login with a legacy hash, call [needsUpgrade] and
/// re-hash the password so the stored value is upgraded to bcrypt.
bool verifyPassword(String password, String storedHash) {
  if (storedHash.startsWith(r'$2')) {
    return BCrypt.checkpw(password, storedHash);
  }
  if (storedHash.length != 64) return false; // unknown / sentinel format
  final sha = sha256.convert(utf8.encode(password)).toString();
  return sha == storedHash;
}

/// True when [storedHash] is a legacy SHA-256 value that should be replaced
/// with a bcrypt hash after the next successful login.
bool needsUpgrade(String storedHash) => !storedHash.startsWith(r'$2');
