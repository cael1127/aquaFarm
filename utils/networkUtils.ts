import NetInfo from '@react-native-community/netinfo';
import { errorHandler } from './errorHandler';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

export class NetworkUtils {
  private static instance: NetworkUtils;
  private networkStatus: NetworkStatus = {
    isConnected: false,
    isInternetReachable: null,
    type: null,
  };

  static getInstance(): NetworkUtils {
    if (!NetworkUtils.instance) {
      NetworkUtils.instance = new NetworkUtils();
    }
    return NetworkUtils.instance;
  }

  async checkConnectivity(): Promise<NetworkStatus> {
    try {
      const state = await NetInfo.fetch();
      this.networkStatus = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };
      return this.networkStatus;
    } catch (error) {
      errorHandler.logError(error as Error, 'Network connectivity check failed');
      return this.networkStatus;
    }
  }

  getCurrentStatus(): NetworkStatus {
    return this.networkStatus;
  }

  isOnline(): boolean {
    return this.networkStatus.isConnected && 
           (this.networkStatus.isInternetReachable === null || this.networkStatus.isInternetReachable);
  }

  async waitForConnection(timeout: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkConnection = async () => {
        const status = await this.checkConnectivity();
        
        if (status.isConnected && status.isInternetReachable) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }
        
        setTimeout(checkConnection, 1000);
      };
      
      checkConnection();
    });
  }

  subscribeToNetworkChanges(callback: (status: NetworkStatus) => void): () => void {
    return NetInfo.addEventListener((state: any) => {
      this.networkStatus = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };
      callback(this.networkStatus);
    });
  }
}

export const networkUtils = NetworkUtils.getInstance();

// API call wrapper with retry logic
export async function apiCall<T>(
  apiFunction: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check connectivity before making the call
      if (!networkUtils.isOnline()) {
        throw new Error('No internet connection');
      }
      
      return await apiFunction();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
  
  throw lastError || new Error('API call failed after all retries');
} 