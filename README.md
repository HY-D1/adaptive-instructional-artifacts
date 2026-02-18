# SQL-Adapt Learning System

An adaptive SQL learning environment where students practice SQL problems with personalized hints and build their own textbook, while instructors monitor progress and analyze learning patterns.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6.3-646CFF)
![Tests](https://img.shields.io/badge/Tests-195%2B%20passing-success)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

**For Students:**
- Practice SQL problems with immediate feedback
- Progressive hints (3 levels) that adapt to your mistakes
- Build a personal textbook from your learning journey
- Chat with your accumulated materials

**For Instructors:**
- Monitor student progress and concept coverage
- View learning analytics and traces
- Export session data for analysis

**Security:**
- Passcode-protected instructor access

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ (LTS recommended)

### Install & Run

```bash
# Clone the repository
git clone <repo-url>
cd adaptive-instructional-artifacts

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Access Guide

### Student Access
1. On the start page, select **"Student"**
2. Begin practicing SQL problems
3. Request hints when stuck — they adapt to your errors
4. Review your personal textbook to see accumulated notes

### Instructor Access
1. On the start page, select **"Instructor"**
2. Enter the passcode when prompted
3. View student analytics, concept coverage, and learning traces
4. Export data for further analysis

## Development

```bash
# Build for production
npm run build

# Run tests
npm run test:e2e:weekly
```

## License

MIT License - see [LICENSE](LICENSE)
