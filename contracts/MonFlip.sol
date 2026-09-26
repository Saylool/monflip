// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/// @notice Testnet-only directional predictions. A trusted CoinGecko relay is the oracle.
contract MonFlip is ReentrancyGuard {
    using MessageHashUtils for bytes32;
    address public immutable oracle;
    uint256 public constant MAX_STAKE = 10 ether;
    uint256 public constant MIN_STAKE = 0.01 ether;
    uint256 public constant GRACE = 120;
    uint256 public totalBalances;
    uint256 public reserved;
    uint256 public nextId;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public nonces;
    mapping(address => uint256[]) private accountTrades;
    struct Trade { address user; uint8 asset; bool up; uint256 stake; uint256 startPrice; uint256 endPrice; uint64 openedAt; uint64 endsAt; uint8 result; uint256 payout; }
    mapping(uint256 => Trade) public trades;
    event Deposited(address indexed user,uint256 amount);
    event Withdrawn(address indexed user,uint256 amount);
    event Opened(uint256 indexed id,address indexed user,uint8 asset,bool up,uint256 stake,uint256 price,uint64 endsAt);
    event Settled(uint256 indexed id,uint8 result,uint256 price,uint256 payout);
    constructor(address oracle_) payable { require(block.chainid == 10143 || block.chainid == 31337, 'Testnet only'); require(oracle_ != address(0),'Oracle required'); oracle=oracle_; }
    function fundHouse() external payable { require(msg.value>0,'Zero amount'); }
    function availableReserve() public view returns(uint256){return address(this).balance-totalBalances-reserved;}
    function deposit() external payable {require(msg.value>0,'Zero amount');balances[msg.sender]+=msg.value;totalBalances+=msg.value;emit Deposited(msg.sender,msg.value);}
    function withdraw(uint256 amount) external nonReentrant {require(amount>0 && balances[msg.sender]>=amount,'Balance'); balances[msg.sender]-=amount;totalBalances-=amount;(bool ok,)=msg.sender.call{value:amount}('');require(ok,'Transfer failed');emit Withdrawn(msg.sender,amount);}
    function tradeCount(address user) external view returns(uint256){return accountTrades[user].length;}
    function tradeIds(address user,uint256 offset,uint256 limit) external view returns(uint256[] memory ids){uint256 n=accountTrades[user].length;if(offset>=n)return new uint256[](0);uint256 end=offset+limit;if(end>n)end=n;ids=new uint256[](end-offset);for(uint256 i=offset;i<end;i++)ids[i-offset]=accountTrades[user][i];}
    function open(uint8 asset,bool up,uint32 duration,uint256 stake,uint256 price,uint64 validUntil,bytes calldata signature) external returns(uint256 id){
        require(asset<3 && (duration==30||duration==60||duration==300),'Selection');
        require(stake>=MIN_STAKE && stake<=MAX_STAKE && balances[msg.sender]>=stake,'Stake');
        require(price>0 && block.timestamp<=validUntil && validUntil<=block.timestamp+60,'Quote expired');
        bytes32 digest=keccak256(abi.encode(block.chainid,address(this),msg.sender,asset,up,duration,stake,price,validUntil,nonces[msg.sender])).toEthSignedMessageHash();
        require(ECDSA.recover(digest,signature)==oracle,'Invalid oracle');
        uint256 payout=stake+stake*80/100;
        require(availableReserve()>=payout-stake,'Reserve insufficient');
        nonces[msg.sender]++; balances[msg.sender]-=stake;totalBalances-=stake;reserved+=payout;
        id=nextId++;uint64 end=uint64(block.timestamp+duration);
        trades[id]=Trade(msg.sender,asset,up,stake,price,0,uint64(block.timestamp),end,0,0);accountTrades[msg.sender].push(id);
        emit Opened(id,msg.sender,asset,up,stake,price,end);
    }
    function settle(uint256 id,uint256 price) external {require(msg.sender==oracle,'Oracle only');Trade storage t=trades[id];require(t.user!=address(0)&&t.result==0,'Not open');require(block.timestamp>=t.endsAt && block.timestamp<=t.endsAt+GRACE,'Settlement window');require(price>0,'Price');uint8 result=price==t.startPrice?3:((t.up && price>t.startPrice)||(!t.up && price<t.startPrice)?1:2);_finish(id,result,price);}
    function refundExpired(uint256 id) external {Trade storage t=trades[id];require(t.user!=address(0)&&t.result==0,'Not open');require(block.timestamp>t.endsAt+GRACE,'Too early');_finish(id,4,0);}
    function _finish(uint256 id,uint8 result,uint256 price) private {Trade storage t=trades[id];uint256 potential=t.stake+t.stake*80/100;uint256 payout=result==1?potential:(result==2?0:t.stake);reserved-=potential;t.result=result;t.endPrice=price;t.payout=payout;balances[t.user]+=payout;totalBalances+=payout;emit Settled(id,result,price,payout);}
}
