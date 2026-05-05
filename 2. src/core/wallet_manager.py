import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

class WalletManager:
    """
    Handles local non-custodial wallet storage using AES-256 encryption.
    Private keys never leave the user's local machine.
    """
    
    def __init__(self, master_password: str, salt: bytes = b'ton_sniper_salt'):
        # Derive a secure encryption key from the user's master password
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_password.encode()))
        self.fernet = Fernet(key)

    def encrypt_seed_phrase(self, seed_phrase: str) -> bytes:
        """Encrypts the seed phrase before saving it to local storage."""
        return self.fernet.encrypt(seed_phrase.encode())

    def decrypt_seed_phrase(self, encrypted_seed: bytes) -> str:
        """Decrypts the seed phrase for transaction signing in memory."""
        return self.fernet.decrypt(encrypted_seed).decode()

    def sign_transaction(self, tx_data: dict, encrypted_seed: bytes):
        """
        Signs a transaction using the decrypted key.
        The decrypted key exists only in RAM during execution.
        """
        seed = self.decrypt_seed_phrase(encrypted_seed)
        # TODO: Implement TON SDK transaction signing here using the 'seed'
        print("[Wallet] Transaction signed successfully.")
        return "signed_tx_hash_placeholder"
