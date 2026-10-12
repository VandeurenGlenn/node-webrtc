#include <atomic>
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <new>

#include "src/node/event_queue.h"

// Standalone test executable only; no allocator overrides enter the addon.
static std::atomic<size_t> allocations{0};
void* operator new(size_t size) {
  allocations.fetch_add(1, std::memory_order_relaxed);
  if (auto ptr = std::malloc(size ? size : 1)) return ptr;
  throw std::bad_alloc();
}
void operator delete(void* ptr) noexcept { std::free(ptr); }
void operator delete(void* ptr, size_t) noexcept { std::free(ptr); }

int main() {
  using Queue = node_webrtc::EventQueue<int>;
  Queue fresh;
  Queue reused;
  Queue::Batch batch;
  constexpr int count = 10000;
  allocations.store(0);
  for (int i = 0; i < count; ++i) {
    fresh.Enqueue(node_webrtc::Event<int>::Create());
    auto received = fresh.TakeAll();
    received.pop();
  }
  const auto before = allocations.load();
  allocations.store(0);
  for (int i = 0; i < count; ++i) {
    reused.Enqueue(node_webrtc::Event<int>::Create());
    reused.TakeAll(batch);
    batch.pop();
  }
  const auto after = allocations.load();
  std::printf("Fresh batches: %zu allocations; reused batches: %zu\n", before, after);
  assert(after < before);
}
