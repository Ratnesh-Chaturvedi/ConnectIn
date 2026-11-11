import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/axios.js";

const initialState = {
  messages: [],
};

export const fetchMessages = createAsyncThunk(
  "message/fetchMessages",
  async ({ token, userId }) => {
    try {
      const { data } = await api.post(
        "/api/message/get",
        { to_user_id: userId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return data.success ? data : null;
    } catch (error) {
      console.error("fetchMessages error:", error);
      return null;
    }
  },
);

const messageSlice = createSlice({
  name: "message",
  initialState,
  reducers: {
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    addMessages: (state, action) => {
      if (!action.payload?._id) return;
      if (!state.messages.some((message) => message._id === action.payload._id)) {
        state.messages.push(action.payload);
      }
    },
    resetMessages: (state) => {
      state.messages = [];
    },
    removeMessage: (state, action) => {
      state.messages = state.messages.filter((msg) => msg._id !== action.payload);
    },
    markMessagesAsSeen: (state, action) => {
      const readerId = action.payload?.userId;
      state.messages = state.messages.map((msg) => {
        const toId = msg.to_user_id?._id ?? msg.to_user_id;
        if (!readerId || toId === readerId) {
          return { ...msg, seen: true };
        }
        return msg;
      });
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      if (action.payload) {
        state.messages = action.payload.messages;
      }
    });
  },
});

export const {
  setMessages,
  resetMessages,
  addMessages,
  removeMessage,
  markMessagesAsSeen,
} = messageSlice.actions;

export default messageSlice.reducer;
