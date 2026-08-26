require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Salon = require('../models/Salon');
const Plan = require('../models/Plan');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const Service = require('../models/Service');
const SubscriptionHistory = require('../models/SubscriptionHistory');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/salon-crm';

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Salon.deleteMany({}),
      Plan.deleteMany({}),
      Client.deleteMany({}),
      Staff.deleteMany({}),
      Service.deleteMany({}),
      SubscriptionHistory.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // 1. Create Plans
    const basicPlan = await Plan.create({
      name: 'Basic',
      price: 999,
      durationInDays: 30,
      maxStaff: 3,
      maxAppointments: 50,
    });

    const premiumPlan = await Plan.create({
      name: 'Premium',
      price: 2499,
      durationInDays: 90,
      maxStaff: 10,
      maxAppointments: 200,
    });

    console.log('Plans created:', basicPlan.name, premiumPlan.name);

    // 2. Create Super Admin
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'admin@salon.com',
      password: 'admin123',
      role: 'SUPER_ADMIN',
    });
    console.log('Super Admin created:', superAdmin.email);

    // 3. Create Salon Owner first (salonId will be set after salon creation)
    const owner = await User.create({
      name: 'Priya Sharma',
      email: 'owner@salon.com',
      password: 'owner123',
      role: 'SALON_OWNER',
    });
    console.log('Salon Owner created:', owner.email);

    // 4. Create Salon (with geo-fencing config)
    const salon = await Salon.create({
      name: 'Glamour Studio',
      ownerId: owner._id,
      address: '123 Beauty Lane, Mumbai 400001',
      phone: '+91-9876543210',
      latitude: 19.0760,
      longitude: 72.8777,
      allowedRadius: 100, // 100 meters
      openingTime: '09:00',
      closingTime: '20:00',
      currentPlan: premiumPlan._id,
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      subscriptionStatus: 'ACTIVE',
    });
    console.log('Salon created:', salon.name);

    // Update owner with salonId
    owner.salonId = salon._id;
    await owner.save();

    // 5. Create Receptionist
    const receptionist = await User.create({
      name: 'Anjali Patel',
      email: 'receptionist@salon.com',
      password: 'receptionist123',
      role: 'RECEPTIONIST',
      salonId: salon._id,
    });
    console.log('Receptionist created:', receptionist.email);

    // 6. Create Staff members
    const staff1 = await Staff.create({
      salonId: salon._id,
      name: 'Rahul Kumar',
      phone: '+91-9876543211',
      services: ['Haircut', 'Hair Color'],
    });

    const staff2 = await Staff.create({
      salonId: salon._id,
      name: 'Neha Gupta',
      phone: '+91-9876543212',
      services: ['Facial', 'Hair Color'],
    });

    const staff3 = await Staff.create({
      salonId: salon._id,
      name: 'Vikram Singh',
      phone: '+91-9876543213',
      services: ['Haircut', 'Facial', 'Hair Color'],
    });

    console.log('Staff created:', staff1.name, staff2.name, staff3.name);

    // 6b. Create Services
    await Service.create([
      { salonId: salon._id, name: 'Haircut', durationInMinutes: 30, price: 350 },
      { salonId: salon._id, name: 'Facial', durationInMinutes: 60, price: 800 },
      { salonId: salon._id, name: 'Hair Color', durationInMinutes: 120, price: 1500 },
    ]);
    console.log('Services created: Haircut (30m), Facial (60m), Hair Color (120m)');

    // 7. Create Clients
    const clients = await Client.create([
      { salonId: salon._id, name: 'Amit Verma', phone: '+91-9111111111', email: 'amit@email.com' },
      { salonId: salon._id, name: 'Sneha Reddy', phone: '+91-9222222222', email: 'sneha@email.com' },
      { salonId: salon._id, name: 'Rohit Mehta', phone: '+91-9333333333', email: 'rohit@email.com' },
      { salonId: salon._id, name: 'Priyanka Nair', phone: '+91-9444444444', email: 'priyanka@email.com' },
      { salonId: salon._id, name: 'Karan Malhotra', phone: '+91-9555555555', email: 'karan@email.com' },
    ]);
    console.log('Clients created:', clients.length);

    // 8. Create subscription history
    await SubscriptionHistory.create({
      salonId: salon._id,
      planId: premiumPlan._id,
      startDate: new Date(),
      endDate: salon.subscriptionEndDate,
      price: premiumPlan.price,
      action: 'ASSIGN',
    });
    console.log('Subscription history created');

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Super Admin:');
    console.log('  Email: admin@salon.com');
    console.log('  Password: admin123');
    console.log('');
    console.log('Salon Owner:');
    console.log('  Email: owner@salon.com');
    console.log('  Password: owner123');
    console.log('');
    console.log('Receptionist:');
    console.log('  Email: receptionist@salon.com');
    console.log('  Password: receptionist123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📍 Salon Location (for geo-fencing):');
    console.log(`  Lat: ${salon.latitude}, Lng: ${salon.longitude}`);
    console.log(`  Radius: ${salon.allowedRadius}m`);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
