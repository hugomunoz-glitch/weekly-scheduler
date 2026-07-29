import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'
// Only load the badge plugin inside the native Capacitor shell.
// Its web implementation calls navigator.setAppBadge() unconditionally
// in the constructor, which throws on browsers that don't support the Badging API.
if (window.Capacitor?.isNativePlatform?.()) {
  import('@capawesome/capacitor-badge')
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '32px', fontFamily: 'monospace', fontSize: '14px' }}>
          <h2 style={{ color: '#ef4444' }}>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#374151', background: '#f9fafb', padding: '16px', borderRadius: '8px', marginTop: '12px' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
)
