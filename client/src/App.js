import { useEffect, useState } from 'react';
import Web3 from 'web3';
import { create } from 'ipfs-http-client';
import MediChain from './contracts/MediChain.json';
import Dashboard from './components/Dashboard.js';
import Home from './components/Home.js';
import Login from './components/Login.js';
import Register from './components/Register.js';
import Footer from './components/Footer';
import SiteNavbar from './components/SiteNavbar';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Mock IPFS object for fallback
const mockIpfs = {
  add: async (content) => {
    console.log('🔧 Using Mock IPFS - File upload simulated');
    // Generate a realistic looking hash
    const mockHash = 'Qm' + Math.random().toString(36).substring(2, 48);
    return { path: mockHash };
  },
  cat: async (hash) => {
    console.log('🔧 Using Mock IPFS - File retrieval simulated for hash:', hash);
    return new TextEncoder().encode('Mock file content for hash: ' + hash);
  }
};

// Mock contract for testing when real contract isn't deployed
const createMockContract = (web3) => {
  // Create a mock PromiEvent that mimics Web3.js behavior
  const createMockPromiEvent = (result) => {
    const mockEvent = {
      on: (event, callback) => {
        if (event === 'transactionHash') {
          setTimeout(() => callback(result.transactionHash), 100);
        } else if (event === 'error') {
          // Don't call error callback for successful operations
        }
        return mockEvent;
      },
      then: (resolve) => {
        setTimeout(() => resolve(result), 200);
        return Promise.resolve(result);
      },
      catch: (reject) => {
        return Promise.resolve(result);
      }
    };
    return mockEvent;
  };

  return {
    methods: {
      register: () => ({ 
        send: () => createMockPromiEvent({ transactionHash: '0xmock123' })
      }),
      login: () => ({ call: async () => '1' }), // Return patient designation
      patientInfo: () => ({ 
        call: async () => ({
          name: 'Test Patient',
          email: 'patient@test.com',
          age: '30',
          record: 'QmMockHash123',
          exists: true,
          policyActive: false
        })
      }),
      doctorInfo: () => ({ 
        call: async () => ({
          name: 'Test Doctor',
          email: 'doctor@test.com',
          exists: true
        })
      }),
      insurerInfo: () => ({ 
        call: async () => ({
          name: 'Test Insurer',
          email: 'insurer@test.com',
          exists: true
        })
      }),
      getPatientDoctorList: () => ({ call: async () => [] }),
      getDoctorPatientList: () => ({ call: async () => [] }),
      getPatientTransactions: () => ({ call: async () => [] }),
      getDoctorTransactions: () => ({ call: async () => [] }),
      getInsurerPolicyList: () => ({ call: async () => [] }),
      getInsurerClaims: () => ({ call: async () => [] }),
      getAllPolicies: () => ({ call: async () => [] }),
      getAllDoctorsAddress: () => ({ call: async () => [] }),
      getAllInsurersAddress: () => ({ call: async () => [] }),
      permitAccess: () => ({ 
        send: () => createMockPromiEvent({ transactionHash: '0xmock456' })
      }),
      buyPolicy: () => ({ 
        send: () => createMockPromiEvent({ transactionHash: '0xmock789' })
      }),
      revokeAccess: () => ({ 
        send: () => createMockPromiEvent({ transactionHash: '0xmockABC' })
      }),
      insuranceClaimRequest: () => ({ 
        send: () => createMockPromiEvent({ transactionHash: '0xmockDEF' })
      }),
      createPolicy: () => ({ 
        send: () => createMockPromiEvent({ transactionHash: '0xmockGHI' })
      }),
      approveClaimsByInsurer: () => ({ 
        send: () => createMockPromiEvent({ transactionHash: '0xmockJKL' })
      }),
      rejectClaimsByInsurer: () => ({ 
        send: () => createMockPromiEvent({ transactionHash: '0xmockMNO' })
      })
    },
    options: {
      address: '0xMockContractAddress'
    }
  };
};

// Configure IPFS to use local node with fallback
const setupIPFS = async () => {
  try {
    // First try local IPFS node
    const ipfs = create({
      url: 'http://127.0.0.1:5001/api/v0',
      timeout: 3000, // 3 second timeout
    });
    
    // Test the connection
    await ipfs.version();
    console.log('✅ Successfully connected to local IPFS node');
    return ipfs;
  } catch (error) {
    console.warn('❌ Local IPFS connection failed, using mock IPFS instead');
    console.warn('Error details:', error.message);
    console.info('💡 To fix: Configure CORS in IPFS or use IPFS Desktop with web interface enabled');
    return mockIpfs;
  }
};

function App() {
  const [account, setAccount] = useState('');
  const [token, setToken] = useState('');
  const [mediChain, setMediChain] = useState(null);
  const [ipfs, setIpfs] = useState(mockIpfs); // Initialize with mock, update with real IPFS if available

  const connectWallet = async () => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts'})
        .then(result => {
          setAccount(result[0]);
        })
        .catch(error => {
         console.log(error)
        });
      window.ethereum.on('chainChanged', () => window.location.reload());
		} else {
			alert('Please use Metamask or a Web3 enabled browser');
		}
  }

  const getContractInstance = async () => {
    try {
      const web3 = new Web3(window.ethereum || Web3.givenProvider || 'http://localhost:7545')
      const networkId = await web3.eth.net.getId()
      console.log('🌐 Current network ID:', networkId)
      
      const networkData = MediChain.networks[networkId]
      if(networkData && networkData.address !== '0x9876543210987654321098765432109876543210'){
        console.log('🚀 Attempting to load real contract at address:', networkData.address)
        const mediChain = new web3.eth.Contract(MediChain.abi, networkData.address)
        
        // Test if the contract is actually deployed by calling a simple view function
        try {
          await mediChain.methods.name().call()
          setMediChain(mediChain)
          console.log('✅ Real contract loaded successfully!')
          return
        } catch (error) {
          console.warn('⚠️ Contract exists in config but not deployed:', error.message)
        }
      }
      
      // Fallback to mock contract
      console.warn('📝 Smart contract not properly deployed, using mock contract for testing')
      console.info('💡 To fix: Deploy the contract to your local Ganache network')
      const mockContract = createMockContract(web3)
      setMediChain(mockContract)
      
    } catch (error) {
      console.error('❌ Error loading contract, using mock contract:', error.message)
      const web3 = new Web3('http://localhost:7545')
      const mockContract = createMockContract(web3)
      setMediChain(mockContract)
    }
  }

  const initializeIPFS = async () => {
    const ipfsInstance = await setupIPFS();
    setIpfs(ipfsInstance);
  }

  useEffect(() => {
    getContractInstance()
    initializeIPFS()
  }, [])

  return (
    <Router>
      <SiteNavbar token={token} account={account} setAccount={setAccount} setToken={setToken}/>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/login' element={<Login mediChain={mediChain} token={token} setToken={setToken} setAccount={setAccount} connectWallet={connectWallet} account={account}/>} />
        <Route path='/dashboard' element={<Dashboard mediChain={mediChain} token={token} account={account} ipfs={ipfs}/>} />
        <Route path='/register' element={<Register mediChain={mediChain} ipfs={ipfs} token={token} setToken={setToken} setAccount={setAccount} connectWallet={connectWallet} account={account} />} />
      </Routes>
      <Footer/>
    </Router>
  );
}

export default App;
