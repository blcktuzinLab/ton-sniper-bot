import re
from telethon import TelegramClient, events

class SocialScanner:
    """
    Monitors Telegram channels and Twitter feeds in real-time to extract
    smart contract addresses and instantly trigger buy orders.
    """

    def __init__(self, api_id: int, api_hash: str, target_channels: list):
        self.client = TelegramClient('sniper_session', api_id, api_hash)
        self.target_channels = target_channels
        self.ton_address_pattern = re.compile(r'EQ[A-Za-z0-9_-]{46}') # Regex for TON addresses

    async def start_listening(self, callback_buy_func):
        """Starts the Telegram client and listens for new messages."""
        print(f"[Social] Connecting to Telegram and monitoring {len(self.target_channels)} channels...")
        
        @self.client.on(events.NewMessage(chats=self.target_channels))
        async def handler(event):
            text = event.message.text
            match = self.ton_address_pattern.search(text)
            
            if match:
                contract_address = match.group(0)
                print(f"[Social] Contract found in {event.chat.username}: {contract_address}")
                # Trigger the buy function instantly
                await callback_buy_func(contract_address)

        await self.client.start()
        await self.client.run_until_disconnected()
