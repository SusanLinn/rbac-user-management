import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  return hashedPassword;
};

// "Admin123"
//    ↓
// bcrypt generates random salt
//    ↓
// hashes password + salt
//    ↓
// $2b$10$....

//login အချိန်မှာ bcrypt.compare() က stored hash ထဲမှာပါတဲ့ salt info ကိုသုံးပြီး verify လုပ်ပေးတာမို့ salt ကို သီးသန့် database column တစ်ခုအဖြစ် သိမ်းစရာမလိုပါဘူး။


export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  const isMatch = await bcrypt.compare(password, hashedPassword);

  return isMatch;
};