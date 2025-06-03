# SpacetimeDB Client

A React-based client for interacting with SpacetimeDB in a multiplayer game environment.

## Features

- Real-time multiplayer state synchronization
- Player management (kick, ban, teleport)
- Entity management
- Chunk loading/unloading
- Admin controls
- Logging system

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/spacetime-db-client.git
cd spacetime-db-client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Usage

The client provides a React context (`SpacetimeDBContext`) that can be used to interact with SpacetimeDB. Here's a basic example:

```tsx
import { useSpacetimeDB } from '@/multiplayer/client/SpacetimeDBContext';

function MyComponent() {
  const { connectionState, players, connect, disconnect } = useSpacetimeDB();

  return (
    <div>
      <p>Connection state: {connectionState}</p>
      <button onClick={connect}>Connect</button>
      <button onClick={disconnect}>Disconnect</button>
      <ul>
        {players.map(player => (
          <li key={player.id}>{player.username}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Project Structure

```
src/
  ├── main.tsx              # Application entry point
  ├── index.css            # Global styles
  └── multiplayer/         # Multiplayer-related code
      ├── client/          # Client-side components
      │   ├── SpacetimeDBContext.tsx
      │   └── SpacetimeDBTest.tsx
      ├── types.ts         # Type definitions
      └── SpacetimeDBManager.ts
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 