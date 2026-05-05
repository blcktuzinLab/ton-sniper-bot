import asyncio
import aiohttp
import time

class RPCManager:
    """
    Manages multiple TON RPC endpoints to ensure zero-delay interactions.
    Automatically selects the node with the lowest latency.
    """

    def __init__(self):
        self.endpoints = [
            "https://toncenter.com/api/v2/jsonRPC",
            "https://go.getblock.io/placeholder/mainnet/",
            # Add more public or private nodes here
        ]
        self.fastest_node = None

    async def ping_node(self, session: aiohttp.ClientSession, url: str):
        """Pings a single node to measure response time."""
        start_time = time.time()
        try:
            async with session.get(url, timeout=2) as response:
                if response.status == 200:
                    latency = time.time() - start_time
                    return url, latency
        except Exception:
            pass
        return url, float('inf')

    async def find_fastest_node(self):
        """Pings all available endpoints and selects the one with the lowest ping."""
        async with aiohttp.ClientSession() as session:
            tasks = [self.ping_node(session, url) for url in self.endpoints]
            results = await asyncio.gather(*tasks)
            
            # Sort by latency and pick the best one
            valid_results = [r for r in results if r[1] != float('inf')]
            if not valid_results:
                raise ConnectionError("No active RPC nodes found!")
                
            valid_results.sort(key=lambda x: x[1])
            self.fastest_node = valid_results[0][0]
            print(f"[RPC] Fastest node selected: {self.fastest_node} ({valid_results[0][1]:.4f}s)")
            
        return self.fastest_node
