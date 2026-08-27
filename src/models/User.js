const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'SALON_OWNER', 'RECEPTIONIST'],
    required: true,
  },
  salonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
    required: false,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
    default: 'ACTIVE',
  },
  // Legacy field kept for backward compatibility; new code should use status
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Keep isActive in sync with status
userSchema.pre('save', async function (next) {
  if (this.isModified('status')) {
    this.isActive = this.status === 'ACTIVE';
  }
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
