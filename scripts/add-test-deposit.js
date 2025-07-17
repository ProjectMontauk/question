const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addTestDeposit() {
  try {
    // Replace this with your actual wallet address
    const walletAddress = "0x65a9E429edFFb87160836761037353C0659A118F"; // Replace with your address
    
    const deposit = await prisma.userDeposits.create({
      data: {
        walletAddress: walletAddress,
        amount: 100000, // $100,000 deposit
        transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000", // Fake transaction hash
      },
    });

    console.log('Test deposit added successfully:', deposit);
  } catch (error) {
    console.error('Error adding test deposit:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestDeposit(); 