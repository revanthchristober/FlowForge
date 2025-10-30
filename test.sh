#!/bin/bash

# FlowForge API Test Suite
# Comprehensive curl-based tests for all endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# URLs
NEXTJS_URL="http://localhost:3000"
INNGEST_URL="http://localhost:8288"
CHAT_API="${NEXTJS_URL}/api/chat"
INNGEST_API="${NEXTJS_URL}/api/inngest"
INNGEST_EVENT_API="${INNGEST_URL}/e/flowforge-demo"

# Helper functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}TEST $((TOTAL_TESTS + 1)): $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ PASS: $1${NC}\n"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

print_failure() {
    echo -e "${RED}✗ FAIL: $1${NC}\n"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

print_info() {
    echo -e "${BLUE}ℹ INFO: $1${NC}"
}

# Check if servers are running
check_servers() {
    print_header "Pre-flight Checks"

    print_info "Checking if Next.js server is running..."
    if curl -s -o /dev/null -w "%{http_code}" "$NEXTJS_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Next.js server is running on $NEXTJS_URL${NC}"
    else
        echo -e "${RED}✗ Next.js server is NOT running!${NC}"
        echo -e "${YELLOW}Please start it with: npm run dev${NC}"
        exit 1
    fi

    print_info "Checking if Inngest dev server is running..."
    if curl -s -o /dev/null -w "%{http_code}" "$INNGEST_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Inngest dev server is running on $INNGEST_URL${NC}"
    else
        echo -e "${RED}✗ Inngest dev server is NOT running!${NC}"
        echo -e "${YELLOW}Please start it with: npx inngest-cli@latest dev${NC}"
        exit 1
    fi

    echo ""
}

# Test 1: Health check - Next.js API
test_nextjs_health() {
    print_test "Next.js Server Health Check"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$NEXTJS_URL")

    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 404 ]; then
        print_success "Next.js server is responding (HTTP $HTTP_CODE)"
    else
        print_failure "Next.js server returned unexpected code: $HTTP_CODE"
    fi
}

# Test 2: Health check - Inngest API endpoint
test_inngest_endpoint() {
    print_test "Inngest API Endpoint Check"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$INNGEST_API")

    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 405 ]; then
        print_success "Inngest API endpoint is accessible (HTTP $HTTP_CODE)"
    else
        print_failure "Inngest API endpoint returned unexpected code: $HTTP_CODE"
    fi
}

# Test 3: Chat API - Simple message
test_chat_simple() {
    print_test "Chat API - Simple Message"

    print_info "Sending: 'Hello!'"

    RESPONSE=$(curl -s -X POST "$CHAT_API" \
        -H "Content-Type: application/json" \
        -d '{
            "messages": [
                {"role": "user", "content": "Hello!"}
            ]
        }')

    if [ -n "$RESPONSE" ]; then
        print_success "Chat API responded with data"
        print_info "Response preview: ${RESPONSE:0:200}..."
    else
        print_failure "Chat API returned empty response"
    fi
}

# Test 4: Chat API - Memory context test
test_chat_with_memory() {
    print_test "Chat API - Memory Context Test"

    print_info "Sending: 'What is FlowForge?'"

    RESPONSE=$(curl -s -X POST "$CHAT_API" \
        -H "Content-Type: application/json" \
        -d '{
            "messages": [
                {"role": "user", "content": "What is FlowForge?"}
            ]
        }')

    if [ -n "$RESPONSE" ]; then
        print_success "Chat API with memory context succeeded"
    else
        print_failure "Chat API with memory context failed"
    fi
}

# Test 5: Chat API - Conversation history
test_chat_conversation() {
    print_test "Chat API - Multi-turn Conversation"

    print_info "Sending conversation with history"

    RESPONSE=$(curl -s -X POST "$CHAT_API" \
        -H "Content-Type: application/json" \
        -d '{
            "messages": [
                {"role": "user", "content": "My name is Alice"},
                {"role": "assistant", "content": "Nice to meet you, Alice!"},
                {"role": "user", "content": "What is my name?"}
            ]
        }')

    if [ -n "$RESPONSE" ]; then
        print_success "Multi-turn conversation succeeded"
    else
        print_failure "Multi-turn conversation failed"
    fi
}

# Test 6: Inngest event - Direct event send
test_inngest_event() {
    print_test "Inngest Event - Direct Send"

    print_info "Sending memory.save event"

    RESPONSE=$(curl -s -X POST "$INNGEST_EVENT_API" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "memory.save",
            "data": {
                "text": "Test memory item from curl",
                "role": "user",
                "metadata": {
                    "test": true,
                    "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
                }
            }
        }')

    if echo "$RESPONSE" | grep -q "eventId\|id"; then
        print_success "Inngest event sent successfully"
        print_info "Response: $RESPONSE"
    else
        print_failure "Inngest event send failed"
        print_info "Response: $RESPONSE"
    fi
}

# Test 7: Memory file check
test_memory_file() {
    print_test "Memory File Creation Check"

    if [ -f "memory.json" ]; then
        LINES=$(wc -l < memory.json)
        print_success "memory.json exists with $LINES entries"

        print_info "Last entry:"
        tail -n 1 memory.json | jq '.' 2>/dev/null || tail -n 1 memory.json
    else
        print_failure "memory.json does not exist"
        print_info "Run chat API tests first to generate memory"
    fi
}

# Test 8: Chat API - Error handling (malformed request)
test_chat_error_handling() {
    print_test "Chat API - Error Handling (Malformed Request)"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CHAT_API" \
        -H "Content-Type: application/json" \
        -d '{"invalid": "data"}')

    if [ "$HTTP_CODE" -eq 400 ] || [ "$HTTP_CODE" -eq 500 ]; then
        print_success "Chat API correctly handles malformed requests (HTTP $HTTP_CODE)"
    else
        print_failure "Chat API did not handle error correctly (HTTP $HTTP_CODE)"
    fi
}

# Test 9: Inngest dashboard check
test_inngest_dashboard() {
    print_test "Inngest Dashboard Accessibility"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$INNGEST_URL")

    if [ "$HTTP_CODE" -eq 200 ]; then
        print_success "Inngest dashboard is accessible at $INNGEST_URL"
    else
        print_failure "Inngest dashboard is not accessible (HTTP $HTTP_CODE)"
    fi
}

# Test 10: Streaming response check
test_streaming_response() {
    print_test "Chat API - Streaming Response"

    print_info "Testing streaming capability (timeout after 5s)"

    RESPONSE=$(timeout 5s curl -s -N -X POST "$CHAT_API" \
        -H "Content-Type: application/json" \
        -d '{
            "messages": [
                {"role": "user", "content": "Count to 5"}
            ]
        }' 2>&1 || true)

    if [ -n "$RESPONSE" ]; then
        print_success "Streaming response received"
    else
        print_failure "No streaming response received"
    fi
}

# Summary
print_summary() {
    print_header "Test Summary"

    echo -e "Total Tests:  ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}\n"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed!${NC}\n"
        exit 1
    fi
}

# Main execution
main() {
    print_header "FlowForge API Test Suite"
    echo -e "Testing FlowForge backend endpoints with curl\n"

    # Pre-flight checks
    check_servers

    # Run all tests
    print_header "Running Tests"

    test_nextjs_health
    test_inngest_endpoint
    test_chat_simple
    test_chat_with_memory
    test_chat_conversation
    test_inngest_event
    test_memory_file
    test_chat_error_handling
    test_inngest_dashboard
    test_streaming_response

    # Print summary
    print_summary
}

# Run main function
main
