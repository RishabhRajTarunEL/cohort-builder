#!/bin/bash

echo "========================================="
echo "  Cohort Builder - Quick Start Script"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker and Docker Compose found"
    echo ""
    echo "Starting services with Docker..."
    docker-compose up -d
    echo ""
    echo -e "${GREEN}✓${NC} Services started!"
    echo ""
    echo "Access the application at:"
    echo "  Frontend:     ${GREEN}http://localhost:3000${NC}"
    echo "  Backend API:  ${GREEN}http://localhost:8000/api/${NC}"
    echo "  Django Admin: ${GREEN}http://localhost:8000/admin/${NC} (admin/admin)"
    echo ""
    echo "To view logs: docker-compose logs -f"
    echo "To stop:      docker-compose down"
else
    echo -e "${YELLOW}⚠${NC}  Docker not found. Please use manual setup."
    echo ""
    echo "Follow these steps:"
    echo ""
    echo "1. Backend Setup:"
    echo "   cd backend"
    echo "   uv venv .venv && source .venv/bin/activate"
    echo "   uv pip install -e ."
    echo "   cp .env.example .env"
    echo "   createdb cohort_builder"
    echo "   python manage.py migrate"
    echo "   python manage.py createsuperuser"
    echo "   python manage.py runserver"
    echo ""
    echo "2. Frontend Setup (new terminal):"
    echo "   cd frontend"
    echo "   npm install"
    echo "   npm run dev"
    echo ""
    echo "See SETUP_GUIDE.md for detailed instructions"
fi
