# Certificate Verification System

A blockchain-based certificate verification system built on Algorand that enables instant verification of educational certificates.

## Features

- **Instant Verification**: Certificates can be verified in seconds using Algorand blockchain
- **Immutable Records**: Certificate hashes are stored on-chain, making them tamper-proof
- **Multi-role Support**: Students, Institutions, and Recruiters
- **RESTful API**: Easy integration with existing systems
- **Modern Frontend**: User-friendly web interface

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Student   │────▶│ Institution │────▶│  Recruiter  │
│   Upload    │     │   Verify    │     │   Verify    │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Algorand   │
                   │  Blockchain │
                   └─────────────┘
```

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: Algorand (algosdk)
- **Frontend**: HTML, CSS, JavaScript

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)
- Algorand Account (for mainnet/testnet)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd certificate-verification-system
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database
```bash
# Create PostgreSQL database
createdb certificate_db

# Run migrations
npx prisma migrate dev
```

5. Start the server
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Running the Frontend

Open `public/index.html` in a web browser, or serve it with a static file server:

```bash
npx serve public
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get current user |

### Certificates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/certificates/issue` | Issue new certificate (Institution Admin) |
| POST | `/api/certificates/verify` | Verify certificate |
| GET | `/api/certificates/:id` | Get certificate details |
| GET | `/api/certificates/student/:id` | Get student's certificates |
| POST | `/api/certificates/revoke` | Revoke certificate |

## Usage Example

### Verify a Certificate

```javascript
const response = await fetch('http://localhost:3000/api/certificates/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    credentialId: 'CERT-ABC123XYZ'
  })
});

const result = await response.json();
console.log(result);
// {
//   success: true,
//   data: {
//     isValid: true,
//     certificate: {
//       studentName: "John Doe",
//       institutionName: "MIT",
//       courseName: "Computer Science",
//       ...
//     }
//   }
// }
```

### Issue a Certificate (Institution Admin)

```javascript
const response = await fetch('http://localhost:3000/api/certificates/issue', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer INSTITUTION_TOKEN'
  },
  body: JSON.stringify({
    studentId: 'student-uuid',
    studentName: 'John Doe',
    institutionId: 'institution-uuid',
    institutionName: 'MIT',
    courseName: 'Computer Science',
    issueDate: '2024-01-15',
    metadata: {
      major: 'AI',
      gpa: 3.8
    }
  })
});
```

## Security Considerations

- Store Algorand mnemonics securely (use environment variables)
- Enable HTTPS in production
- Implement rate limiting for API endpoints
- Use strong password policies
- Enable multi-factor authentication

## Cost Estimation

- **Algorand Testnet**: Free
- **Algorand Mainnet**: ~0.1 ALGO per certificate issuance
- **PostgreSQL**: $0-50/month (depends on provider)
- **Server**: $20-50/month

## License

MIT License
