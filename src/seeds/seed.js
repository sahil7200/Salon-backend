require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Salon = require('../models/Salon');
const Plan = require('../models/Plan');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
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
      Appointment.deleteMany({}),
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
      status: 'ACTIVE',
    });
    console.log('Super Admin created:', superAdmin.email);

    // 3. Create Salon Owner
    const owner = await User.create({
      name: 'Priya Sharma',
      email: 'owner@salon.com',
      password: 'owner123',
      role: 'SALON_OWNER',
      status: 'ACTIVE',
    });
    console.log('Salon Owner created:', owner.email);

    // 4. Create Salon
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
      subscriptionEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      subscriptionStatus: 'ACTIVE',
      status: 'ACTIVE',
    });
    console.log('Salon created:', salon.name);

    owner.salonId = salon._id;
    await owner.save();

    // 5. Create Receptionist
    const receptionist = await User.create({
      name: 'Anjali Patel',
      email: 'receptionist@salon.com',
      password: 'receptionist123',
      role: 'RECEPTIONIST',
      salonId: salon._id,
      status: 'ACTIVE',
    });
    console.log('Receptionist created:', receptionist.email);

    // 6. Create Services in DB
    const service1 = await Service.create({
      salonId: salon._id,
      name: 'Haircut',
      durationInMinutes: 30,
      price: 500,
      isActive: true,
    });

    const service2 = await Service.create({
      salonId: salon._id,
      name: 'Facial',
      durationInMinutes: 60,
      price: 1500,
      isActive: true,
    });

    const service3 = await Service.create({
      salonId: salon._id,
      name: 'Hair Color',
      durationInMinutes: 120,
      price: 3000,
      isActive: true,
    });
    console.log('Services created:', service1.name, service2.name, service3.name);

    // 7. Create Staff members
    const staff1 = await Staff.create({
      salonId: salon._id,
      name: 'Rahul Kumar',
      phone: '+91-9876543211',
      services: ['Haircut', 'Hair Color'],
      status: 'ACTIVE',
    });

    const staff2 = await Staff.create({
      salonId: salon._id,
      name: 'Neha Gupta',
      phone: '+91-9876543212',
      services: ['Facial', 'Hair Color'],
      status: 'ACTIVE',
    });

    console.log('Staff created:', staff1.name, staff2.name);

    // 8. Create Clients
    const client1 = await Client.create({
      salonId: salon._id,
      name: 'Sunita Verma',
      email: 'sunita@example.com',
      phone: '+91-9811111111',
      status: 'ACTIVE',
    });

    const client2 = await Client.create({
      salonId: salon._id,
      name: 'Karan Mehta',
      email: 'karan@example.com',
      phone: '+91-9822222222',
      status: 'ACTIVE',
    });

    console.log('Clients created:', client1.name, client2.name);

    // 9. Create Seed Appointments with Snapshots
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appt1 = await Appointment.create({
      salonId: salon._id,
      client: client1._id,
      serviceId: service1._id,
      serviceNameSnapshot: service1.name,
      serviceDurationSnapshot: service1.durationInMinutes,
      servicePriceSnapshot: service1.price,
      staff: staff1._id,
      date: today,
      startTime: '10:00',
      endTime: '10:30',
      status: 'CONFIRMED',
    });

    const appt2 = await Appointment.create({
      salonId: salon._id,
      client: client2._id,
      serviceId: service2._id,
      serviceNameSnapshot: service2.name,
      serviceDurationSnapshot: service2.durationInMinutes,
      servicePriceSnapshot: service2.price,
      staff: staff2._id,
      date: today,
      startTime: '11:00',
      endTime: '12:00',
      status: 'PENDING',
    });

    console.log('Appointments created:', appt1._id, appt2._id);

    // 10. Initial Subscription History
    await SubscriptionHistory.create({
      salonId: salon._id,
      planId: premiumPlan._id,
      startDate: salon.subscriptionStartDate,
      endDate: salon.subscriptionEndDate,
      price: premiumPlan.price,
      action: 'ASSIGN',
      performedBy: superAdmin._id,
    });
    console.log('Subscription history seeded');

    console.log('\n--- SEED COMPLETE ---');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
