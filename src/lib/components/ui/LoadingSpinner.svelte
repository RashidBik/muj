<div class="loading">
  <div class="spinner"></div>
  <p>در حال بارگذاری موج‌ها...</p>
</div>

<style>
  .loading {
    text-align: center;
    padding: 60px 20px;
    color: #65676b;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e4e6eb;
    border-top-color: #1877f2;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>