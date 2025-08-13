import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface QuickAction {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: string;
}

const ChatbotScreen = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your Oyster Farm Assistant. I can help you with:\n\n• Managing your oyster farm operations\n• Understanding harvest data\n• Setting up oyster cages and batches\n• Inventory management\n• Analytics and reports\n• Oyster farming best practices\n\nHow can I assist you today?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const quickActions: QuickAction[] = [
    { id: '1', title: 'How to add oyster cages?', icon: 'add-circle-outline', action: 'add_cages' },
    { id: '2', title: 'Check oyster harvest', icon: 'basket-outline', action: 'harvest_data' },
    { id: '3', title: 'Inventory help', icon: 'list-outline', action: 'inventory_help' },
    { id: '4', title: 'Farm analytics', icon: 'analytics-outline', action: 'analytics_help' },
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const generateResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();

    // Cage management responses
    if (message.includes('cage') || message.includes('add cage')) {
      return "To add a new cage:\n\n1. Go to the Farm Map screen\n2. Tap the '+' button\n3. Fill in cage details:\n   • Name (e.g., 'A1', 'North-1')\n   • Type (Oyster/Mussel or Salmon)\n   • Coordinates (X, Y position)\n4. Tap 'Add Cage'\n\nEach cage can hold up to 6 bags. You can manage bags by tapping the small bag icon on each cage.";
    }

    // Harvest tracking responses
    if (message.includes('harvest') || message.includes('harvest data')) {
      return "For harvest tracking:\n\n📊 **View Data**: Go to Harvest Tracking screen to see all records\n\n📝 **Add Harvest**: Tap '+' to record new harvest with:\n• Date and time\n• Cage and bag details\n• Quantity harvested\n• Quality grade\n• Market price\n\n📈 **Analytics**: Check Reports screen for harvest trends and performance metrics.";
    }

    // Inventory management responses
    if (message.includes('inventory') || message.includes('stock')) {
      return "Inventory Management features:\n\n📦 **Categories**:\n• Equipment (nets, buoys, anchors)\n• Feed and nutrition\n• Chemicals and treatments\n• General supplies\n\n🔍 **Features**:\n• Search and filter items\n• Low stock alerts\n• Cost tracking\n• Add/edit/delete items\n\n💡 **Tip**: Set minimum stock levels to get automatic alerts when supplies run low!";
    }

    // Analytics and reports
    if (message.includes('analytics') || message.includes('report') || message.includes('data')) {
      return "Analytics & Reports help:\n\n📊 **Available Reports**:\n• Production trends\n• Harvest performance\n• Growth rates\n• Financial summaries\n• Inventory status\n\n📈 **Key Metrics**:\n• Total production\n• Average harvest size\n• Mortality rates\n• Revenue tracking\n\nGo to the Reports screen to view detailed charts and export data.";
    }

    // Batch management
    if (message.includes('batch') || message.includes('cohort')) {
      return "Batch Management:\n\n🐟 **Creating Batches**:\n1. Go to Batch Management screen\n2. Tap '+' to add new batch\n3. Set species, quantity, and source\n4. Assign to specific cages\n\n📋 **Tracking**:\n• Growth monitoring\n• Health status\n• Feed consumption\n• Mortality tracking\n\n🔄 **Status Updates**: Regular updates help optimize feeding and harvest timing.";
    }

    // Settings and configuration
    if (message.includes('setting') || message.includes('config')) {
      return "Settings & Configuration:\n\n⚙️ **Farm Settings**:\n• Farm name and location\n• Owner information\n• Regional preferences\n\n🔔 **Notifications**:\n• Harvest reminders\n• Low stock alerts\n• Maintenance schedules\n\n💾 **Data Management**:\n• Export data\n• Backup settings\n• Import from other systems\n\nAccess Settings from the main menu.";
    }

    // Water quality and environmental
    if (message.includes('water') || message.includes('quality') || message.includes('environment')) {
      return "Water Quality & Environment:\n\n🌊 **Key Parameters**:\n• Temperature monitoring\n• Salinity levels\n• Dissolved oxygen\n• pH levels\n• Turbidity\n\n📱 **Recording**: Use the dashboard to log daily measurements\n\n⚠️ **Alerts**: Set thresholds for automatic warnings when parameters are out of range\n\n📊 **Trends**: View historical data in the Analytics section";
    }

    // Disease and health management
    if (message.includes('disease') || message.includes('health') || message.includes('mortality')) {
      return "Health & Disease Management:\n\n🏥 **Health Monitoring**:\n• Regular visual inspections\n• Mortality tracking\n• Growth rate monitoring\n• Behavioral observations\n\n💊 **Treatment Records**:\n• Medication usage\n• Treatment dates\n• Dosage tracking\n• Withdrawal periods\n\n📋 **Best Practices**:\n• Quarantine new stock\n• Maintain water quality\n• Regular equipment cleaning\n• Monitor stocking density";
    }

    // General aquaculture advice
    if (message.includes('advice') || message.includes('tip') || message.includes('best practice')) {
      return "🌟 **Aquaculture Best Practices**:\n\n📅 **Daily Tasks**:\n• Check water parameters\n• Visual health inspection\n• Record observations\n• Monitor equipment\n\n📊 **Weekly Tasks**:\n• Growth measurements\n• Inventory checks\n• Equipment maintenance\n• Data analysis\n\n🎯 **Success Tips**:\n• Consistent monitoring\n• Accurate record keeping\n• Regular equipment maintenance\n• Stay informed on industry trends";
    }

    // Troubleshooting
    if (message.includes('problem') || message.includes('issue') || message.includes('error') || message.includes('help')) {
      return "🔧 **Troubleshooting Help**:\n\n❓ **Common Issues**:\n• App crashes: Restart the app\n• Data not saving: Check storage permissions\n• Charts not loading: Refresh the screen\n• Sync issues: Check internet connection\n\n📞 **Need More Help?**:\n• Check the Settings > About section\n• Contact support through the app\n• Visit our help documentation\n• Join the community forum";
    }

    // Default response
    return "I'm here to help with your aquafarm management! I can assist with:\n\n🗺️ Farm mapping and cage setup\n🐟 Batch and harvest management\n📊 Analytics and reporting\n📦 Inventory tracking\n⚙️ Settings and configuration\n🌊 Water quality monitoring\n🏥 Health management\n\nCould you be more specific about what you'd like help with?";
  };

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const response = generateResponse(inputText.trim());
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
  };

  const handleQuickAction = (action: string) => {
    let message = '';
    switch (action) {
      case 'add_cages':
        message = 'How do I add new cages to my farm?';
        break;
      case 'harvest_data':
        message = 'Help me understand harvest data and tracking';
        break;
      case 'inventory_help':
        message = 'How does inventory management work?';
        break;
      case 'analytics_help':
        message = 'Show me how to use analytics and reports';
        break;
    }
    
    setInputText(message);
  };

  const clearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMessages([
              {
                id: '1',
                text: "Chat cleared! How can I help you with your aquafarm management?",
                isUser: false,
                timestamp: new Date(),
              },
            ]);
          },
        },
      ]
    );
  };

  const renderMessage = (message: Message) => (
    <View
      key={message.id}
      style={[
        styles.messageContainer,
        message.isUser ? styles.userMessage : styles.botMessage,
      ]}
    >
      <Text style={[
        styles.messageText,
        message.isUser ? styles.userMessageText : styles.botMessageText,
      ]}>
        {message.text}
      </Text>
      <Text style={[
        styles.timestamp,
        message.isUser ? styles.userTimestamp : styles.botTimestamp,
      ]}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="chatbubbles" size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Aquafarm Assistant</Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
          <Ionicons name="trash-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map(renderMessage)}
          
          {isTyping && (
            <View style={[styles.messageContainer, styles.botMessage]}>
              <View style={styles.typingIndicator}>
                <Text style={styles.typingText}>Assistant is typing</Text>
                <View style={styles.typingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.quickActionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionButton}
                onPress={() => handleQuickAction(action.action)}
              >
                <Ionicons name={action.icon} size={16} color={Colors.primary} />
                <Text style={styles.quickActionText}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask me anything about aquafarm management..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={500}
            onSubmitEditing={handleSendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim() === '' && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={inputText.trim() === ''}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() === '' ? Colors.textSecondary : Colors.white}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 10,
  },
  clearButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messagesContent: {
    paddingVertical: 10,
  },
  messageContainer: {
    marginVertical: 5,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderRadius: 18,
    borderBottomRightRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: Colors.white,
  },
  botMessageText: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 5,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  botTimestamp: {
    color: Colors.textSecondary,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 10,
  },
  typingDots: {
    flexDirection: 'row',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
    marginHorizontal: 1,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  quickActionsContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  quickActionText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 5,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
});

export default ChatbotScreen;
